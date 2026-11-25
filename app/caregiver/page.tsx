"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import RoleGate from "@/components/RoleGate";
import { useSync } from "@/components/SyncProvider";
import { supabase } from "@/lib/supabase/client";
import { TOPICS } from "@/lib/content";

interface LinkRow { id: string; patient_user_id: string; patient_alias: string; created_at: string; }
interface ShareRow { patient_user_id: string; topic_ids: string[]; completed_topic_ids: string[]; updated_at: string; }

export default function CaregiverPortal() {
  const { user } = useSync();
  const [token, setToken] = useState("");
  const [consent, setConsent] = useState(false);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const sb = supabase();
    if (!sb || !user) return;
    setLoading(true); setError(""); setNotice(""); setToken(""); setConsent(false); setLinks([]); setShares([]); setLoadedUserId(null);
    const { data: linkData, error: linkError } = await sb.from("caregiver_links")
      .select("id,patient_user_id,patient_alias,created_at")
      .eq("caregiver_user_id", user.id).is("revoked_at", null).order("created_at", { ascending: false });
    if (linkError) { setError(linkError.message); setLoadedUserId(user.id); setLoading(false); return; }
    const active = (linkData ?? []) as LinkRow[];
    setLinks(active);
    if (active.length) {
      const { data: shareData, error: shareError } = await sb.from("caregiver_learning_shares")
        .select("patient_user_id,topic_ids,completed_topic_ids,updated_at")
        .in("patient_user_id", active.map(link => link.patient_user_id));
      if (shareError) setError(shareError.message);
      else setShares((shareData ?? []) as ShareRow[]);
    } else setShares([]);
    setLoadedUserId(user.id); setLoading(false);
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (user && loadedUserId !== user.id) return <RoleGate role="caregiver"><div className="card"><p className="muted">Loading protected caregiver data…</p></div></RoleGate>;

  const accept = async (event: React.FormEvent) => {
    event.preventDefault();
    const sb = supabase();
    if (!sb || !token.trim() || !consent) return;
    setError(""); setNotice("");
    const { error: rpcError } = await sb.rpc("accept_caregiver_link_invite", { p_token: token.trim(), p_caregiver_consent: true });
    if (rpcError) { setError(rpcError.message); return; }
    setToken(""); setConsent(false); setNotice("The link is active. You can only see learning topics the patient chose to share."); await refresh();
  };

  const revoke = async (id: string) => {
    const sb = supabase();
    if (!sb || !confirm("Remove your access to this shared learning summary?")) return;
    const { error: rpcError } = await sb.rpc("revoke_caregiver_link", { p_link_id: id });
    if (rpcError) setError(rpcError.message);
    else { setNotice("The link was revoked."); await refresh(); }
  };

  return <RoleGate role="caregiver">
    <div className="eyebrow">Caregiver workspace</div><h1>Family learning support</h1>
    <p className="muted" style={{ maxWidth: 700 }}>A caregiver can access only a patient’s opted-in topic and walkthrough summary. This portal never reads chats, questions, feelings, profile notes, or medical records.</p>
    {notice && <div className="callout good" role="status">{notice}</div>}
    {error && <div className="banner" role="alert">Could not complete the request: {error}. Check that the latest Supabase migration has been applied and that both accounts have the required roles.</div>}
    <div className="card"><h2>Accept a patient invitation</h2>
      <p>Ask the patient to share their one-time code with you directly. Codes expire after 72 hours and can be used once. Do not send codes through public or shared channels.</p>
      <form onSubmit={accept}>
        <label htmlFor="caregiver-invite">One-time invitation code</label>
        <input id="caregiver-invite" autoComplete="off" value={token} onChange={event => setToken(event.target.value)} />
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontWeight: 400 }}>
          <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />
          I consent to this link and understand that it shares only the learning summary the patient has enabled.
        </label>
        <div className="row"><button className="btn" disabled={!token.trim() || !consent || loading}>Accept invitation</button></div>
      </form>
    </div>
    <div className="card"><h2>Linked learning summaries</h2>
      {loading && <p className="muted">Loading protected links…</p>}
      {!loading && !links.length && !error && <p className="muted">No active links. A patient must invite you, record their assent and guardian permission, and enable sharing.</p>}
      {links.map(link => {
        const share = shares.find(item => item.patient_user_id === link.patient_user_id);
        const names = new Map(TOPICS.map(topic => [topic.id, topic.title]));
        return <section className="step" key={link.id} style={{ display: "block" }}>
          <div className="row" style={{ justifyContent: "space-between", marginTop: 0 }}>
            <div><h3>{link.patient_alias}</h3><span className="muted">Linked {new Date(link.created_at).toLocaleDateString()}</span></div>
            <button className="btn alt" onClick={() => void revoke(link.id)}>Revoke access</button>
          </div>
          {!share ? <p className="muted">The patient has not enabled sharing or has removed their shared summary.</p> :
            <><p>Topics selected: {share.topic_ids.map(id => names.get(id) ?? "Other topic").join(", ") || "None"}</p>
              <p>Walkthroughs completed: {share.completed_topic_ids.map(id => names.get(id) ?? "Other topic").join(", ") || "None recorded"}</p>
              <p className="muted">Last shared {new Date(share.updated_at).toLocaleString()}. These are learning activities, not clinical outcomes.</p></>}
        </section>;
      })}
      <div className="row"><button className="btn alt" onClick={() => void refresh()} disabled={loading}>Refresh shared summaries</button><Link className="btn alt" href="/family">Family resources</Link></div>
    </div>
  </RoleGate>;
}
