"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { TOPICS } from "@/lib/content";
import { useQs } from "@/lib/store";
const CATS = ["Diagnosis", "Procedure", "Tests and imaging", "Treatment", "Recovery", "School", "Daily life", "Emotional concerns"];
export default function Questions() {
  const [qs, setQs, ready] = useQs(); const [text, setText] = useState(""); const [cat, setCat] = useState("Procedure"); const [topic, setTopic] = useState(TOPICS[0].id); const [busy, setBusy] = useState(false); const [clarifyError, setClarifyError] = useState<string | null>(null); const [f, setF] = useState("All");
  if (!ready) return null;
  const t = TOPICS.find(x => x.id === topic)!; const add = (tx: string, c: string) => tx.trim() && !qs.some(q => q.text === tx) && setQs(a => [...a, { id: Math.random().toString(36).slice(2), text: tx.trim(), cat: c, answered: false }]);
  const clarify = async () => {
    setBusy(true); setClarifyError(null);
    try {
      const r = await fetch("/api/clarify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      const result: unknown = await r.json();
      if (!r.ok || typeof result !== "object" || result === null || !("text" in result) || typeof result.text !== "string" || !result.text.trim()) {
        throw new Error("The wording service did not return a question.");
      }
      setText(result.text);
    } catch {
      setClarifyError("Could not clarify the wording. Please check your connection or edit the question yourself.");
    } finally { setBusy(false); }
  };
  const shown = qs.filter(q => f === "All" || q.cat === f);
  return (<><div className="eyebrow">Question builder</div><h1>My questions</h1><p className="muted">Build a list to bring to your healthcare team. Onconnect helps with wording but does not answer personal medical questions.</p>
    <div className="card"><h2>Add a question</h2><input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Write your own question…" aria-label="Your question" />
      <div className="chips" style={{ margin: "10px 0" }}>{CATS.map(c => <button key={c} className={"chip" + (cat === c ? " on" : "")} onClick={() => setCat(c)}>{c}</button>)}</div>
      <div className="row"><button className="btn" onClick={() => { add(text, cat); setText(""); }} disabled={!text.trim()}>Add</button><button className="btn alt" onClick={clarify} disabled={!text.trim() || busy}>{busy ? "Working…" : "Clarify my wording"}</button></div>
      {clarifyError && <div className="banner" role="alert">{clarifyError}</div>}
      <h3 style={{ marginTop: 18 }}>Suggested</h3><div className="chips">{TOPICS.map(x => <button key={x.id} className={"chip" + (topic === x.id ? " on" : "")} onClick={() => setTopic(x.id)}>{x.title}</button>)}</div>
      {t.questions.map(q => <p key={q}>{q} <button className="btn alt sm" disabled={qs.some(x => x.text === q)} onClick={() => add(q, cat)}>{qs.some(x => x.text === q) ? "Added" : "Add"}</button></p>)}</div>
    <div className="card" id="sheet"><h2>Appointment question sheet</h2><div className="chips" style={{ marginBottom: 10 }}>{["All", ...CATS].map(c => <button key={c} className={"chip" + (f === c ? " on" : "")} onClick={() => setF(c)}>{c}</button>)}</div>
      {!shown.length && <p className="muted">Nothing here yet.</p>}
      {shown.map(q => <div key={q.id} className="step" style={{ alignItems: "center" }}><input type="checkbox" checked={q.answered} onChange={() => setQs(a => a.map(x => x.id === q.id ? { ...x, answered: !x.answered } : x))} aria-label="Answered" /><span style={{ flex: 1, textDecoration: q.answered ? "line-through" : "none" }}>{q.text}<span className="tagl">{q.cat}</span></span><button className="btn alt sm" onClick={() => setQs(a => a.filter(x => x.id !== q.id))} aria-label="Remove question"><X size={14} /></button></div>)}
      <div className="row"><button className="btn alt" onClick={() => window.print()}>Print sheet</button><button className="btn alt" onClick={() => navigator.clipboard?.writeText(shown.map((q, i) => `${i + 1}. ${q.text}`).join("\n"))}>Copy list</button></div></div></>);
}
