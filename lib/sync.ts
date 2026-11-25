// Pure merge logic for local-first sync. No Supabase and no DOM in here, so it is easy to test.
// Rule: never lose data. Lists are unioned by id; single objects are last-write-wins, and on the first sync the local copy wins.

/** localStorage keys that are synced. Theme, text size, eval scratch data and sync bookkeeping stay on the device. */
export const SYNC_KEYS = ["onc.profile", "onc.convos", "onc.memory", "onc.log", "onc.bookmarks", "onc.feelings", "onc.qs", "onc.study", "onc.ratings", "onc.viewed", "onc.words", "onc.plan", "onc.journal", "onc.saved", "onc.protocol", "onc.ethics", "onc.procedures"] as const;
export const isSyncKey = (k: string): boolean => (SYNC_KEYS as readonly string[]).includes(k);
export const shouldClearLocalForUserSwitch = (previous: string | null, current: string | null): boolean => Boolean(previous && current && previous !== current);
/** Keys that hold lists of records and can be merged instead of overwritten. */
const LISTS = new Set(["onc.convos", "onc.log", "onc.bookmarks", "onc.feelings", "onc.qs", "onc.study", "onc.ratings", "onc.viewed", "onc.words", "onc.journal"]);
export const isList = (k: string) => LISTS.has(k);

export type Meta = Record<string, string>;                 // key -> ISO time this device last wrote or synced it
export interface RemoteRow { key: string; value: unknown; updated_at: string; }
export type Action = { key: string; op: "none" } | { key: string; op: "pushLocal" } | { key: string; op: "applyRemote"; value: unknown } | { key: string; op: "merged"; value: unknown };

const stamp = (x: unknown): number => { const o = x as { ts?: unknown; updatedAt?: unknown }; const v = o?.ts ?? o?.updatedAt; const t = typeof v === "number" ? v : typeof v === "string" ? Date.parse(v) : NaN; return Number.isFinite(t) ? t : 0; };
const idOf = (x: unknown): string => (x && typeof x === "object" && "id" in x ? String((x as { id: unknown }).id) : JSON.stringify(x));

/** Union of two lists. For the same id the newer record wins (ties go to the larger one). Order: newest first when records have timestamps. */
export function mergeLists(a: unknown[], b: unknown[]): unknown[] {
  const out = new Map<string, unknown>();
  for (const x of [...a, ...b]) {
    const id = idOf(x); const had = out.get(id);
    if (had === undefined) { out.set(id, x); continue; }
    const [sa, sb] = [stamp(had), stamp(x)];
    if (sb > sa || (sb === sa && JSON.stringify(x).length > JSON.stringify(had).length)) out.set(id, x);
  }
  const arr = [...out.values()];
  return arr.every(x => stamp(x) > 0) ? arr.sort((p, q) => stamp(q) - stamp(p)) : arr;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Decide, for every synced key, what to do given this device's data, its sync metadata and what the cloud holds. */
export function planSync(local: Record<string, unknown>, meta: Meta, remote: RemoteRow[]): Action[] {
  const byKey = new Map(remote.map(r => [r.key, r]));
  return SYNC_KEYS.map((key): Action => {
    const l = local[key]; const r = byKey.get(key); const hasL = l !== undefined && l !== null;
    if (!r) return hasL ? { key, op: "pushLocal" } : { key, op: "none" };
    if (!hasL) return { key, op: "applyRemote", value: r.value };
    if (same(l, r.value)) return { key, op: "none" };
    if (isList(key) && Array.isArray(l) && Array.isArray(r.value)) return { key, op: "merged", value: mergeLists(l, r.value) };
    const mine = meta[key];                                  // objects: last write wins, and with no history the local copy wins
    return mine && Date.parse(r.updated_at) > Date.parse(mine) ? { key, op: "applyRemote", value: r.value } : { key, op: "pushLocal" };
  }).filter(a => a.op !== "none");
}
