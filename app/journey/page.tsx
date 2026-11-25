"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Circle, Copy, MessageSquare, Play, BookOpen } from "lucide-react";
import { TOPICS } from "@/lib/content";
import { QUIZ } from "@/lib/more";
import { summarizeTopicJourney } from "@/lib/journey";
import { useChat } from "@/lib/chat";
import { useProcedureProgress, useProfile, useViewed } from "@/lib/store";
import { useSync } from "@/components/SyncProvider";
import { hasAppRole } from "@/lib/roles";
import { supabase } from "@/lib/supabase/client";
interface PatientLink { id: string; caregiver_user_id: string; patient_alias: string; created_at: string; revoked_at: string | null; }

function PatientSharing({ topics, completed }: { topics: string[]; completed: string[] }) {
  const { user, configured } = useSync();
  const [enabled, setEnabled] = useState(false); const [ready, setReady] = useState(false);
  const [alias, setAlias] = useState("My child"); const [assent, setAssent] = useState(false); const [permission, setPermission] = useState(false);
  const [code, setCode] = useState(""); const [links, setLinks] = useState<PatientLink[]>([]);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const isPatient = hasAppRole(user?.app_metadata, "patient");

  const refresh = async () => {
    const sb = supabase();
    if (!user || !sb || !isPatient) { setReady(true); return; }
    setReady(false); setEnabled(false); setLinks([]); setLoadedUserId(null); setCode(""); setError("");
    const [shareResult, linkResult] = await Promise.all([
      sb.from("caregiver_learning_shares").select("patient_user_id").eq("patient_user_id", user.id).maybeSingle(),
      sb.from("caregiver_links").select("id,caregiver_user_id,patient_alias,created_at,revoked_at").eq("patient_user_id", user.id).is("revoked_at", null),
    ]);
    if (shareResult.error || linkResult.error) setError(shareResult.error?.message ?? linkResult.error?.message ?? "Could not load sharing settings.");
    else { setEnabled(Boolean(shareResult.data)); setLinks((linkResult.data ?? []) as PatientLink[]); }
    setLoadedUserId(user.id); setReady(true);
  };
  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [isPatient, user]);

  if (!configured || !user || !isPatient) return null;
  if (loadedUserId !== user.id) return <section className="card"><p className="muted">Loading private sharing settings…</p></section>;

  const updateShare = async (value: boolean) => {
    const sb = supabase();
    if (!sb || !user) return;
    setError(""); setNotice("");
    const result = value
      ? await sb.from("caregiver_learning_shares").upsert({ patient_user_id: user.id, topic_ids: topics, completed_topic_ids: completed, updated_at: new Date().toISOString() }, { onConflict: "patient_user_id" })
      : await sb.from("caregiver_learning_shares").delete().eq("patient_user_id", user.id);
    if (result.error) { setError(result.error.message); return; }
    setEnabled(value); setNotice(value ? "Your selected topics and completed walkthroughs are now shared with active linked caregivers." : "Your shared learning summary was removed.");
  };

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    const sb = supabase();
    if (!sb || !assent || !permission || !alias.trim()) return;
    setError(""); setNotice(""); setCode("");
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    const { error: rpcError } = await sb.rpc("create_caregiver_link_invite", {
      p_token: token, p_patient_alias: alias.trim(), p_patient_assent: true, p_guardian_permission: true,
    });
    if (rpcError) { setError(rpcError.message); return; }
    setCode(token); setAssent(false); setPermission(false);
    setNotice("Invitation created. The code is shown once and expires in 72 hours.");
  };

  const revokeLink = async (id: string) => {
    const sb = supabase();
    if (!sb || !confirm("Revoke this caregiver's access?")) return;
    const { error: rpcError } = await sb.rpc("revoke_caregiver_link", { p_link_id: id });
    if (rpcError) setError(rpcError.message);
    else { setNotice("Caregiver access revoked."); await refresh(); }
  };

  const cancelInvites = async () => {
    const sb = supabase();
    if (!sb || !confirm("Cancel all pending invitation codes?")) return;
    const { error: rpcError } = await sb.rpc("revoke_pending_caregiver_invites");
    if (rpcError) setError(rpcError.message);
    else { setCode(""); setNotice("Pending caregiver invitations were cancelled."); }
  };

  return <section className="card">
    <h2>Caregiver sharing (optional)</h2>
    <p>Sharing is off until you turn it on. The only shared fields are selected topic IDs and walkthrough completion IDs—never chats, questions, notes, mood check-ins, or medical details. A linked caregiver must also accept the invite.</p>
    {notice && <div className="callout good" role="status">{notice}</div>}
    {error && <div className="banner" role="alert">Could not update sharing: {error}. Confirm the latest Supabase migration is applied and your account has the patient role.</div>}
    {!ready ? <p className="muted">Checking sharing settings…</p> : <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontWeight: 400 }}>
      <input type="checkbox" checked={enabled} onChange={event => void updateShare(event.target.checked)} />
      Share my selected topics and walkthrough activity with linked caregivers
    </label>}
    {enabled && <div className="row"><button className="btn alt" onClick={() => void updateShare(true)}>Update shared summary</button></div>}
    {links.length > 0 && <><h3 style={{ marginTop: 16 }}>Active links</h3>{links.map(link => <div className="step" key={link.id}><span style={{ flex: 1 }}>{link.patient_alias}<div className="muted">Caregiver account linked {new Date(link.created_at).toLocaleDateString()}</div></span><button className="btn alt sm" onClick={() => void revokeLink(link.id)}>Revoke</button></div>)}</>}
    <form onSubmit={invite}>
      <label htmlFor="caregiver-alias">A private label for the caregiver view</label>
      <input id="caregiver-alias" maxLength={32} value={alias} onChange={event => setAlias(event.target.value)} />
      <p className="muted">Use a nickname, not a full legal name or other identifying information.</p>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontWeight: 400 }}>
        <input type="checkbox" checked={assent} onChange={event => setAssent(event.target.checked)} />
        I confirm that the patient has given assent to this learning-summary link.
      </label>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontWeight: 400 }}>
        <input type="checkbox" checked={permission} onChange={event => setPermission(event.target.checked)} />
        I confirm that a parent or legal guardian has given permission.
      </label>
      <div className="row"><button className="btn alt" disabled={!alias.trim() || !assent || !permission}>Create one-time invite code</button></div>
    </form>
    {code && <div className="banner" role="status"><b>Share this code privately; it will not be shown again:</b><p><code>{code}</code></p>
      <button className="btn alt" onClick={async () => { try { await navigator.clipboard.writeText(code); setNotice("Invitation code copied."); } catch { setError("Clipboard access is unavailable; select and copy the code manually."); } }}><Copy size={14} />Copy code</button></div>}
    <button className="btn alt" style={{ marginTop: 8 }} onClick={() => void cancelInvites()}>Cancel all pending invitations</button>
    <p className="muted">Consent is recorded as self-attestation, not independently verified. Either linked person can revoke access. This feature does not share medical records.</p>
  </section>;
}

export default function Journey() {
  const { convos, ready: chatReady } = useChat();
  const [profile, , profileReady] = useProfile();
  const [viewed, , viewedReady] = useViewed();
  const [progress, , progressReady] = useProcedureProgress();
  if (!chatReady || !profileReady || !viewedReady || !progressReady) return null;

  const topics = profile.topics.map(id => TOPICS.find(topic => topic.id === id)).filter((topic): topic is (typeof TOPICS)[number] => Boolean(topic));
  const completed = topics.filter(topic => progress[topic.id]?.completedAt).length;
  const chatTopics = new Set(convos.flatMap(convo => convo.msgs.map(message => message.reply?.topicId).filter((id): id is string => Boolean(id))));

  return <>
    <div className="eyebrow">Learning plan</div>
    <h1>My care journey</h1>
    <p className="muted" style={{ maxWidth: 700 }}>A record of topics you chose, guides you opened, and walkthroughs you completed. This tracks learning activities only; it does not measure understanding, readiness, or medical progress.</p>
    {topics.length > 0 && <div className="stat" style={{ maxWidth: 520 }}>
      <div><b>{topics.length}</b><span>Topics in your plan</span></div>
      <div><b>{completed}</b><span>Walkthroughs completed</span></div>
      <div><b>{topics.filter(topic => chatTopics.has(topic.id)).length}</b><span>Topics discussed in chat</span></div>
    </div>}
    {topics.length === 0 ? <div className="card"><h2>Choose what you want to learn</h2><p>Your plan is empty. Pick topics in your profile to build a journey that matters to you.</p><Link className="btn" href="/setup">Choose learning topics <ArrowRight size={15} /></Link></div> :
      <>
        <div className="bar" aria-label={`${completed} of ${topics.length} walkthroughs completed`}><i style={{ width: `${(completed / topics.length) * 100}%` }} /></div>
        <p className="muted">{completed} of {topics.length} walkthroughs completed. You can revisit any topic at any time.</p>
        {topics.map(topic => {
          const status = summarizeTopicJourney(topic.id, viewed, progress, QUIZ[topic.id] ?? []);
          const discussed = chatTopics.has(topic.id);
          const date = progress[topic.id]?.completedAt;
          return <section className="card" key={topic.id}>
            <h2>{topic.title}</h2>
            <ul className="plain">
              <li>{status.guideViewed ? <Check size={15} aria-hidden /> : <Circle size={15} aria-hidden />} Guide {status.guideViewed ? "opened" : "not opened yet"}</li>
              <li>{status.walkthroughCompleted ? <Check size={15} aria-hidden /> : status.walkthroughStarted ? <Play size={15} aria-hidden /> : <Circle size={15} aria-hidden />}
                Walkthrough {status.walkthroughCompleted ? `completed${date ? ` on ${new Date(date).toLocaleDateString()}` : ""}` : status.walkthroughStarted ? "in progress" : "not started"}
                {status.walkthroughStarted && !status.walkthroughCompleted && <span className="muted"> · saved at stage {status.stageIndex + 1}</span>}
              </li>
              {status.quizTotal > 0 && <li><BookOpen size={15} aria-hidden /> Optional check: {status.quizAnswered ? `${status.quizAnswered}/${status.quizTotal} answered, ${status.quizCorrect} correct` : "not attempted"}</li>}
              <li><MessageSquare size={15} aria-hidden /> Chat discussion {discussed ? "recorded" : "not recorded"}</li>
            </ul>
            <p className="muted">Your activity is saved in this browser and may sync to your account when sync is enabled.</p>
            <div className="row">
              <Link className="btn alt" href={`/procedures/${topic.id}`}>Open guide</Link>
              <Link className="btn" href={`/procedures/${topic.id}?mode=walk`}>{status.walkthroughCompleted ? "Review walkthrough" : status.walkthroughStarted ? "Continue walkthrough" : "Start walkthrough"} <ArrowRight size={15} /></Link>
              <Link className="btn alt" href="/chat">Ask about this topic</Link>
            </div>
          </section>;
        })}
      </>}
    <p className="muted">Learning activities are self-directed. A correct answer in an optional check does not show mastery or replace guidance from your care team.</p>
    <PatientSharing topics={topics.map(topic => topic.id)} completed={topics.filter(topic => progress[topic.id]?.completedAt).map(topic => topic.id)} />
  </>;
}
