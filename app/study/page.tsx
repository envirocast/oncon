"use client";
import { useRef, useState } from "react";
import { TOPICS, PROFILES, type Level } from "@/lib/content";
import { QUIZ } from "@/lib/more";
import { DEFAULT_PROFILE, respond } from "@/lib/engine";
import { metrics } from "@/lib/metrics";
import { mean, sd, welch } from "@/lib/stats";
import { useStudy, type StudyRow } from "@/lib/store";
import { shareStudy } from "@/lib/research";

const csv = (rows: StudyRow[]) => { const h = ["id", "ts", "pid", "condition", "topic", "age", "score", "total", "selfRated", "ms", "grade"]; return [h.join(","), ...rows.map(r => h.map(k => `"${(r as any)[k] ?? ""}"`).join(","))].join("\n"); };
export default function Study() {
  const [rows, setRows, ready] = useStudy(); const [phase, setPhase] = useState<"setup" | "read" | "quiz" | "done">("setup");
  const [pid, setPid] = useState(""); const [age, setAge] = useState<Level>("9-11"); const [topic, setTopic] = useState("biopsy");
  const [cond, setCond] = useState<"adapted" | "generic">("adapted"); const [text, setText] = useState(""); const [ans, setAns] = useState<number[]>([]); const [self, setSelf] = useState(0); const t0 = useRef(0); const [ok, setOk] = useState(false);
  if (!ready) return null;
  const quiz = QUIZ[topic] ?? [];
  const start = () => {
    const n = (c: string) => rows.filter(r => r.condition === c && r.age === age).length; const a = n("adapted"), g = n("generic");
    const c: "adapted" | "generic" = a === g ? (crypto.getRandomValues(new Uint8Array(1))[0] % 2 ? "adapted" : "generic") : a < g ? "adapted" : "generic"; // balanced within age band
    const tp = TOPICS.find(x => x.id === topic)!;
    const out = c === "adapted" ? respond(`What is ${tp.title}?`, { ...DEFAULT_PROFILE, age, detail: "balanced", format: ["steps", "examples"] }, null).text : tp.why["15-17"];
    setCond(c); setText(out); setAns([]); setSelf(0); t0.current = Date.now(); setPhase("read");
  };
  const submit = () => { const score = quiz.filter((q, i) => ans[i] === q.answer).length;
    const row: StudyRow = { id: Math.random().toString(36).slice(2, 8), ts: new Date().toISOString(), pid, condition: cond, topic, age, score, total: quiz.length, selfRated: self, ms: Date.now() - t0.current, grade: metrics(text).grade }; setRows(r => [...r, row]); void shareStudy(row); setPhase("done"); };
  const A = rows.filter(r => r.condition === "adapted").map(r => r.score / r.total * 100), G = rows.filter(r => r.condition === "generic").map(r => r.score / r.total * 100); const w = welch(A, G);
  const f = (v: number, d = 1) => Number.isFinite(v) ? v.toFixed(d) : "–";
  return (<><div className="eyebrow">Comprehension study</div><h1>Does adapting an explanation improve understanding?</h1>
    <div className="banner"><b>Before collecting real data:</b> research with human participants, especially children, needs your fair&apos;s review committee and IRB approval first, plus parental permission and child assent. Until that is approved, use this only to test the tool yourself. Use participant codes, never names.</div>
    <div className="card"><h2>Design</h2><p><b>H1:</b> children shown an age-adapted explanation score higher on a short comprehension quiz than children shown the same facts in a generic, adult-level explanation.</p>
      <p className="muted">Between-subjects, random assignment balanced within each age band. Outcomes: quiz score (%) and self-rated understanding (1–5). Analysis: Welch&apos;s t-test, Cohen&apos;s d. Both conditions use the same source-linked draft facts, so only the delivery differs.</p></div>
    {phase === "setup" && <div className="card"><h2>New participant</h2><label>Participant code</label><input type="text" value={pid} onChange={e => setPid(e.target.value)} placeholder="e.g. P001" /><label>Age band</label>
      <div className="chips">{(Object.keys(PROFILES) as Level[]).map(a => <button key={a} className={"chip" + (age === a ? " on" : "")} onClick={() => setAge(a)}>{a}</button>)}</div><label>Topic</label><div className="chips">{TOPICS.map(x => <button key={x.id} className={"chip" + (topic === x.id ? " on" : "")} onClick={() => setTopic(x.id)}>{x.title}</button>)}</div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}><input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} /> Approval, permission and assent are in place (or this is a self-test)</label>
      <div className="row"><button className="btn" disabled={!pid.trim() || !ok} onClick={start}>Begin</button></div></div>}
    {phase === "read" && <div className="card"><h2>Read this</h2><p style={{ whiteSpace: "pre-wrap" }}>{text}</p><div className="row"><button className="btn" onClick={() => setPhase("quiz")}>I&apos;m done reading</button></div></div>}
    {phase === "quiz" && <div className="card"><h2>Quick questions</h2>{quiz.map((q, i) => <div key={q.q} style={{ margin: "14px 0" }}><b>{q.q}</b><div className="chips" style={{ marginTop: 6 }}>{q.options.map((o, x) => <button key={o} className={"chip" + (ans[i] === x ? " on" : "")} onClick={() => setAns(a => { const n = [...a]; n[i] = x; return n; })}>{o}</button>)}</div></div>)}
      <label>How well did you understand it? (1 = not at all, 5 = completely)</label><div className="chips">{[1, 2, 3, 4, 5].map(n => <button key={n} className={"chip" + (self === n ? " on" : "")} onClick={() => setSelf(n)}>{n}</button>)}</div>
      <div className="row"><button className="btn" disabled={ans.filter(x => x !== undefined).length < quiz.length || !self} onClick={submit}>Submit</button></div></div>}
    {phase === "done" && <div className="card"><h2>Thank you</h2><p>Response recorded.</p><button className="btn" onClick={() => setPhase("setup")}>Next participant</button></div>}
    <div className="card"><h2>Results so far</h2><div className="kpi"><div><b>{rows.length}</b><span>Responses</span></div><div><b>{A.length}</b><span>Adapted</span></div><div><b>{G.length}</b><span>Generic</span></div></div>
      <table><thead><tr><th>Condition</th><th>n</th><th>Mean score %</th><th>SD</th><th>Mean self-rated</th></tr></thead><tbody>{(["adapted", "generic"] as const).map(c => { const r = rows.filter(x => x.condition === c); return <tr key={c}><td>{c}</td><td>{r.length}</td><td>{f(mean(r.map(x => x.score / x.total * 100)))}</td><td>{f(sd(r.map(x => x.score / x.total * 100)))}</td><td>{f(mean(r.map(x => x.selfRated)), 2)}</td></tr>; })}</tbody></table>
      {w ? <p style={{ marginTop: 12 }}>Welch t({f(w.df)}) = {f(w.t, 2)}, p = {w.p < 0.001 ? "< .001" : f(w.p, 3)}, Cohen&apos;s d = {f(w.d, 2)}, mean difference = {f(w.diff)} points (95% CI {f(w.ci[0])} to {f(w.ci[1])}).</p> : <p className="muted">At least 2 responses per condition are needed for a test. For a large effect (d ≈ 0.8) you need roughly 26 per group.</p>}
      <div className="row"><button className="btn alt" disabled={!rows.length} onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv(rows)], { type: "text/csv" })); a.download = "onconnect-study.csv"; a.click(); }}>Export CSV</button><button className="btn alt" disabled={!rows.length} onClick={() => confirm("Delete all study data?") && setRows([])}>Clear</button></div></div></>);
}
