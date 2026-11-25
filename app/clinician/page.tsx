"use client";
import { useCallback, useEffect, useState } from "react";
import RoleGate from "@/components/RoleGate";
import Citations from "@/components/Citations";
import { useSync } from "@/components/SyncProvider";
import { parseContentVersion, type ContentVersion } from "@/lib/approvedContent";
import { supabase } from "@/lib/supabase/client";

type Decision = "approve" | "request_revision" | "reject";
const DECISIONS: { id: Decision; label: string }[] = [
  { id: "approve", label: "Approve this version" },
  { id: "request_revision", label: "Request revision" },
  { id: "reject", label: "Reject this version" },
];

export default function ClinicianReview() {
  const { user } = useSync();
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [accuracy, setAccuracy] = useState(0); const [ageFit, setAgeFit] = useState(0); const [safety, setSafety] = useState(0);
  const [decision, setDecision] = useState<Decision>("approve"); const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const sb = supabase();
    if (!sb) return;
    setLoading(true); setError("");
    const { data, error: queryError } = await sb.from("educational_content_versions")
      .select("id,topic_id,version,payload,source_ids,status,created_by,created_at")
      .eq("status", "pending_review").order("created_at", { ascending: true });
    if (queryError) { setError(queryError.message); setLoading(false); return; }
    const rows = (data ?? []).map(parseContentVersion).filter((row): row is ContentVersion => row !== null);
    setVersions(rows); setSelectedId(current => rows.some(row => row.id === current && row.createdBy !== user?.id) ? current : rows.find(row => row.createdBy !== user?.id)?.id ?? "");
    setLoading(false);
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  const eligible = versions.filter(version => version.createdBy !== user?.id);
  const current = eligible.find(version => version.id === selectedId) ?? eligible[0];
  const Scale = ({ value, set, label }: { value: number; set: (next: number) => void; label: string }) => <div>
    <label>{label}</label><div className="chips">{[1, 2, 3, 4, 5].map(n => <button key={n} type="button" className={"chip" + (value === n ? " on" : "")} onClick={() => set(n)} aria-pressed={value === n}>{n}</button>)}</div>
  </div>;

  const submit = async () => {
    const sb = supabase();
    if (!sb || !current || !accuracy || !ageFit || !safety) return;
    setError(""); setNotice("");
    const { error: rpcError } = await sb.rpc("review_educational_content", {
      p_version_id: current.id, p_decision: decision, p_accuracy: accuracy, p_age_fit: ageFit, p_safety: safety, p_comment: comment,
    });
    if (rpcError) { setError(rpcError.message); return; }
    setNotice(`${current.topic.title} v${current.version} was ${decision.replaceAll("_", " ")}. Approval is now available to chat retrieval.`);
    setAccuracy(0); setAgeFit(0); setSafety(0); setComment(""); setDecision("approve"); await refresh();
  };

  return <RoleGate role="clinician">
    <div className="eyebrow">Verified clinician workspace</div><h1>Review educational content</h1>
    <p className="muted" style={{ maxWidth: 720 }}>Review drafts for medical accuracy, age fit, and safety. Your authenticated clinician role—not a typed name—identifies the reviewer. Authors cannot review their own submissions. Approval publishes this exact immutable version for chat retrieval.</p>
    {notice && <div className="callout good" role="status">{notice}</div>}
    {error && <div className="banner" role="alert">Review failed: {error}. Confirm the current Supabase migration and your clinician role assignment.</div>}
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", marginTop: 0 }}><h2>Versions awaiting review</h2><button className="btn alt" onClick={() => void refresh()} disabled={loading}>Refresh</button></div>
      {loading && <p className="muted">Loading protected drafts…</p>}
      {!loading && !eligible.length && <p className="muted">No reviewable drafts are waiting. An administrator can stage the current source-linked corpus in the administrator workspace.</p>}
      {current && <>
        <label htmlFor="review-version">Select a draft</label>
        <select id="review-version" value={current.id} onChange={event => setSelectedId(event.target.value)}>{eligible.map(version => <option key={version.id} value={version.id}>{version.topic.title} · v{version.version}</option>)}</select>
        <div className="card" style={{ marginTop: 18 }}>
          <div className="eyebrow">{current.topicId} · version {current.version}</div><h2>{current.topic.title}</h2>
          {(Object.entries(current.topic.why) as [string, string][]).map(([age, text]) => <section key={age}><h3>Ages {age}</h3><p>{text}</p></section>)}
          <h3>General steps</h3><ol>{current.topic.steps.map(step => <li key={step}>{step}</li>)}</ol>
          <h3>Question prompts</h3><ul>{current.topic.questions.map(question => <li key={question}>{question}</li>)}</ul>
          <h3>Mapped sources</h3><Citations items={current.references} />
        </div>
        <Scale value={accuracy} set={setAccuracy} label="Medical accuracy (1–5)" />
        <Scale value={ageFit} set={setAgeFit} label="Age appropriateness (1–5)" />
        <Scale value={safety} set={setSafety} label="Safety and tone (1–5)" />
        <label>Decision</label><div className="chips">{DECISIONS.map(item => <button key={item.id} type="button" className={"chip" + (decision === item.id ? " on" : "")} onClick={() => setDecision(item.id)} aria-pressed={decision === item.id}>{item.label}</button>)}</div>
        <label htmlFor="review-comment">Review notes (optional, max 1,200 characters)</label><textarea id="review-comment" maxLength={1200} className="big" style={{ minHeight: 90 }} value={comment} onChange={event => setComment(event.target.value)} />
        <div className="row"><button className="btn" disabled={!accuracy || !ageFit || !safety || loading} onClick={() => void submit()}>Submit authenticated review</button></div>
      </>}
    </div>
  </RoleGate>;
}
