"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, CloudOff, LogOut, RefreshCw } from "lucide-react";
import { useSync } from "@/components/SyncProvider";
import { supabase } from "@/lib/supabase/client";
import { SHARE_KEY } from "@/lib/research";
import { appRoles } from "@/lib/roles";

const ERRORS: Record<string, string> = { signin_failed: "That sign-in link did not work. It may have expired. Request a new one.", missing_code: "The sign-in link was incomplete. Request a new one.", not_configured: "Cloud sync is not set up on this deployment." };

function Account() {
  const { configured, user, status, lastSync, error, syncNow, signOut, deleteCloud, ready } = useSync(); const q = useSearchParams();
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false); const [err, setErr] = useState<string | null>(q.get("error") ? ERRORS[q.get("error")!] ?? "Sign-in failed." : null); const [busy, setBusy] = useState(false);
  const [share, setShare] = useState(false); const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => { try { setShare(localStorage.getItem(SHARE_KEY) === "1"); } catch {} }, []);
  const toggleShare = (v: boolean) => { setShare(v); try { localStorage.setItem(SHARE_KEY, v ? "1" : "0"); } catch {} };
  const sendLink = async (e: React.FormEvent) => { e.preventDefault(); const sb = supabase(); if (!sb || !email.includes("@")) return; setBusy(true); setErr(null);
    const { error: er } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${location.origin}/auth/callback` } }); setBusy(false); if (er) setErr(er.message); else setSent(true); };
  const when = lastSync ? new Date(lastSync).toLocaleString() : "never";

  return (<><div className="eyebrow">You</div><h1>Account and sync</h1>
    <p>Onconnect works without an account. Your data stays in this browser unless you sign in to sync it to your private account.</p>

    {!configured && <div className="card"><h2><CloudOff size={18} style={{ verticalAlign: "-3px", marginRight: 8 }} />Cloud sync is not connected</h2>
      <p>This deployment has no Supabase project yet, so data stays on this device. To turn cloud features on, create a Supabase project, apply both migrations in order, and set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. Steps are in <code>supabase/README.md</code>.</p></div>}

    {configured && ready && !user && <div className="card"><h2>Sign in with email</h2>
      {sent ? <p><Check size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />Check your inbox for a sign-in link. You can close this tab.</p> : <form onSubmit={sendLink}>
        <label htmlFor="em">Email address</label><input id="em" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
        <div className="row"><button className="btn" disabled={busy || !email.includes("@")}>{busy ? "Sending" : "Email me a sign-in link"}</button></div>
        <p className="muted" style={{ marginTop: 16 }}>No password. We use your email only to sign you in. Children should sign in with a parent or guardian&apos;s email.</p></form>}
      {err && <div className="banner" style={{ marginTop: 16 }} role="alert">{err}</div>}</div>}

    {configured && user && <>
      <div className="card"><h2>Signed in</h2><p>{user.email}</p>
        <p className="muted">{status === "syncing" ? "Syncing…" : status === "error" ? "Sync problem" : "Up to date"} · last sync {when}</p>
        <p>Workspace roles: {appRoles(user.app_metadata).join(", ") || "none assigned"}</p>
        {(error || err) && <div className="banner" role="alert">{error ?? err}</div>}
        <div className="row"><button className="btn" onClick={syncNow} disabled={status === "syncing"}><RefreshCw size={15} />Sync now</button><button className="btn alt" onClick={signOut}><LogOut size={15} />Sign out</button></div>
        <p className="muted" style={{ marginTop: 16 }}>Synced: profile, chats, memory, saved items, check-ins, questions, journal, study notes, and procedure progress. Lists are merged so nothing is overwritten. Theme and text size stay on each device. Switching to a different signed-in account clears the prior account&apos;s synced local data before pulling the new account.</p>
        <p className="muted">Roles are assigned through trusted project administration after identity checks; changing your profile cannot grant access. A project administrator must verify clinician credentials and research eligibility.</p></div>

      <div className="card"><h2>Share pseudonymized data for research</h2>
        <p>Off by default. When on, each answer you receive sends its <em>measurements</em> to the research database: age band, target and measured reading grade, word count, which adaptations fired, topic, model, and your feedback. It never sends what you typed, what Onconnect said, or your profile notes.</p>
        <label style={{ display: "flex", gap: 12, alignItems: "center", fontWeight: 500 }}><input type="checkbox" checked={share} onChange={e => toggleShare(e.target.checked)} />Share measurements with the research team</label>
        <p className="muted">These rows are pseudonymized, not anonymous. Only turn this on if you are an adult participant, or a parent or guardian has agreed, and the study has been approved by your school or fair&apos;s review committee. You can turn it off any time and erase what was sent below.</p></div>

      <div className="card"><h2>Erase my cloud data</h2><p>Removes synced personal state, research submissions, caregiver sharing, and review records. Retained educational content versions remain but are detached from your account. Data on this device is not touched.</p>
        {confirmDel ? <div className="row"><button className="btn" onClick={async () => { await deleteCloud(); setConfirmDel(false); }}>Yes, erase it</button><button className="btn alt" onClick={() => setConfirmDel(false)}>Cancel</button></div>
          : <div className="row"><button className="btn alt" onClick={() => setConfirmDel(true)}>Erase cloud data</button></div>}</div></>}
  </>);
}
export default function AccountPage() { return <Suspense><Account /></Suspense>; }
