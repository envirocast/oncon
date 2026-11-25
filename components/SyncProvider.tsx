"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabase/client";
import { SYNC_KEYS, isSyncKey, planSync, shouldClearLocalForUserSwitch, type Meta, type RemoteRow } from "@/lib/sync";
import { WRITE, notifyRemote } from "@/lib/syncbus";

type Status = "off" | "signed-out" | "idle" | "syncing" | "error";
interface Ctx { configured: boolean; user: User | null; status: Status; lastSync: string | null; error: string | null; syncNow: () => Promise<void>; signOut: () => Promise<void>; deleteCloud: () => Promise<void>; ready: boolean; }
const C = createContext<Ctx>({ configured: false, user: null, status: "off", lastSync: null, error: null, syncNow: async () => {}, signOut: async () => {}, deleteCloud: async () => {}, ready: true });
export const useSync = () => useContext(C);

const META = "onc.syncmeta", LAST = "onc.synclast", SYNC_USER = "onc.syncuser";
const readMeta = (): Meta => { try { return JSON.parse(localStorage.getItem(META) || "{}"); } catch { return {}; } };
const readLocal = (): Record<string, unknown> => { const o: Record<string, unknown> = {}; for (const k of SYNC_KEYS) { try { const v = localStorage.getItem(k); if (v !== null) o[k] = JSON.parse(v); } catch {} } return o; };

/** Local-first sync. The app always works from localStorage; when signed in, changes are mirrored to Supabase `user_state` and pulled on sign-in. */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  const configured = supabaseConfigured();
  const [user, setUser] = useState<User | null>(null); const [ready, setReady] = useState(!configured);
  const [status, setStatus] = useState<Status>(configured ? "signed-out" : "off"); const [lastSync, setLast] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const dirty = useRef(new Set<string>()); const timer = useRef<ReturnType<typeof setTimeout> | null>(null); const busy = useRef(false); const uid = useRef<string | null>(null);
  const syncRunner = useRef<() => Promise<void>>(async () => {});

  const stampSync = () => { const t = new Date().toISOString(); setLast(t); try { localStorage.setItem(LAST, t); } catch {} };
  const fail = (e: unknown) => { setStatus("error"); setError(e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "Sync failed"); };
  const bindUser = (id: string | null): boolean => {
    uid.current = id;
    if (!id) return true;
    try {
      const previous = localStorage.getItem(SYNC_USER);
      if (shouldClearLocalForUserSwitch(previous, id)) {
        dirty.current.clear();
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        for (const key of SYNC_KEYS) { localStorage.removeItem(key); notifyRemote(key); }
        localStorage.removeItem(META); localStorage.removeItem(LAST); localStorage.removeItem("onc.share");
        setLast(null);
      }
      localStorage.setItem(SYNC_USER, id);
      return true;
    } catch (e) { fail(e); return false; }
  };

  const push = useCallback(async (keys: string[], expectedUserId?: string) => {
    const sb = supabase(); const id = uid.current; if (!sb || !id || (expectedUserId && id !== expectedUserId) || !keys.length) return;
    const now = new Date().toISOString(); const meta = readMeta(); const rows: { user_id: string; key: string; value: unknown; updated_at: string }[] = [];
    for (const key of keys) { try { const v = localStorage.getItem(key); if (v !== null) { rows.push({ user_id: id, key, value: JSON.parse(v), updated_at: now }); meta[key] = now; } } catch {} }
    if (!rows.length) return;
    const { error: e } = await sb.from("user_state").upsert(rows, { onConflict: "user_id,key" });
    if (e) throw e;
    if (uid.current === id) { try { localStorage.setItem(META, JSON.stringify(meta)); } catch {} }
  }, []);

  const syncNow = useCallback(async () => {
    const sb = supabase(); const id = uid.current; if (!sb || !id || busy.current) return; busy.current = true; setStatus("syncing"); setError(null);
    try {
      const { data, error: e } = await sb.from("user_state").select("key,value,updated_at"); if (e) throw e;
      if (uid.current !== id) return;
      const plan = planSync(readLocal(), readMeta(), (data ?? []) as RemoteRow[]); const meta = readMeta(); const toPush: string[] = [];
      for (const a of plan) {
        if (a.op === "applyRemote" || a.op === "merged") { try { localStorage.setItem(a.key, JSON.stringify(a.value)); } catch {} notifyRemote(a.key); meta[a.key] = new Date().toISOString(); }
        if (a.op === "pushLocal" || a.op === "merged") toPush.push(a.key);
      }
      try { localStorage.setItem(META, JSON.stringify(meta)); } catch {}
      await push(toPush, id);
      if (uid.current === id) { stampSync(); setStatus("idle"); }
    } catch (e) { if (uid.current === id) fail(e); }
    finally {
      busy.current = false;
      if (uid.current && uid.current !== id) queueMicrotask(() => { void syncRunner.current(); });
    }
  }, [push]);
  syncRunner.current = syncNow;

  // session
  useEffect(() => {
    const sb = supabase(); if (!sb) return; try { setLast(localStorage.getItem(LAST)); } catch {}
    sb.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) fail(sessionError);
      const session = data.session; const bound = bindUser(session?.user.id ?? null);
      setUser(session?.user ?? null); if (!sessionError) setStatus(session ? "idle" : "signed-out"); setReady(true);
      if (session && bound) void syncNow();
    });
    const { data: sub } = sb.auth.onAuthStateChange((ev, s) => {
      const bound = bindUser(s?.user.id ?? null); setUser(s?.user ?? null);
      if (bound) setStatus(s ? "idle" : "signed-out");
      if (ev === "SIGNED_IN" && s && bound) void syncNow();
    });
    return () => sub.subscription.unsubscribe();
  }, [syncNow]);

  // mirror local writes (debounced)
  useEffect(() => {
    if (!configured) return;
    const h = (e: Event) => { const k = (e as CustomEvent).detail?.key as string; if (!uid.current || !isSyncKey(k)) return; dirty.current.add(k);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => { const targetId = uid.current; const keys = [...dirty.current]; dirty.current.clear(); try { setStatus("syncing"); await push(keys, targetId ?? undefined); if (uid.current === targetId) { stampSync(); setStatus("idle"); } } catch (err) { if (uid.current === targetId) fail(err); } }, 2000); };
    addEventListener(WRITE, h); return () => { removeEventListener(WRITE, h); if (timer.current) clearTimeout(timer.current); };
  }, [configured, push]);

  const signOut = useCallback(async () => { await supabase()?.auth.signOut(); }, []);
  const deleteCloud = useCallback(async () => { const sb = supabase(); if (!sb) return; const { error: e } = await sb.rpc("delete_my_data"); if (e) fail(e); else { try { localStorage.removeItem(META); } catch {} setLast(null); } }, []);
  return <C.Provider value={{ configured, user, status, lastSync, error, syncNow, signOut, deleteCloud, ready }}>{children}</C.Provider>;
}
