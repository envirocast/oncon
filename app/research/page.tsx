"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLog, useMemory, useRatings, useStudy } from "@/lib/store";
import { mean } from "@/lib/stats";
import RoleGate from "@/components/RoleGate";
import { useSync } from "@/components/SyncProvider";
import { supabase } from "@/lib/supabase/client";
type RemoteRow = Record<string, string | number | boolean | null>;

function exportCsv(name: string, rows: RemoteRow[]) {
  if (!rows.length) return;
  const headers = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const quote = (value: unknown) => {
    const text = String(value ?? "");
    const safe = typeof value === "string" && /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const text = [headers.join(","), ...rows.map(row => headers.map(header => quote(row[header])).join(","))].join("\n");
  const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); anchor.download = name; anchor.click();
}

function SharedResearchData() {
  const { user } = useSync();
  const [answers, setAnswers] = useState<RemoteRow[]>([]); const [studies, setStudies] = useState<RemoteRow[]>([]);
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const sb = supabase();
    if (!sb || !user) return;
    setLoading(true); setError("");
    const [answerResult, studyResult] = await Promise.all([
      sb.from("research_answers_export").select("*").order("created_at", { ascending: false }).limit(5000),
      sb.from("study_responses_export").select("*").order("created_at", { ascending: false }).limit(5000),
    ]);
    if (answerResult.error || studyResult.error) setError(answerResult.error?.message ?? studyResult.error?.message ?? "Could not load shared research rows.");
    setAnswers((answerResult.data ?? []) as RemoteRow[]); setStudies((studyResult.data ?? []) as RemoteRow[]);
    setLoading(false);
  }, [user]);
  useEffect(() => { void refresh(); }, [refresh]);
  const grades = answers.flatMap(row => {
    const grade = typeof row.grade === "number" ? row.grade : typeof row.grade === "string" && row.grade.trim() ? Number(row.grade) : NaN;
    return Number.isFinite(grade) ? [grade] : [];
  });
  const meanGrade = grades.length ? (grades.reduce((sum, grade) => sum + grade, 0) / grades.length).toFixed(1) : "n/a";
  return <section className="card">
    <h2>Shared research data</h2>
    <p className="muted">Rows are pseudonymized and contain structured measurements only. They are read through Supabase RLS; chat text, profile notes, and names are not included. Results are descriptive, not evidence of effectiveness.</p>
    {error && <div className="banner" role="alert">Could not load shared data: {error}. Confirm the latest database migration and researcher role assignment.</div>}
    <div className="kpi"><div><b>{answers.length}</b><span>Answer measurements</span></div><div><b>{studies.length}</b><span>Study responses</span></div><div><b>{meanGrade}</b><span>Mean measured grade</span></div></div>
    <div className="row"><button className="btn alt" onClick={() => void refresh()} disabled={loading}>Refresh shared data</button>
      <button className="btn alt" onClick={() => exportCsv("onconnect-shared-answers.csv", answers)} disabled={!answers.length}>Export answer CSV</button>
      <button className="btn alt" onClick={() => exportCsv("onconnect-shared-study.csv", studies)} disabled={!studies.length}>Export study CSV</button></div>
    <p className="muted">{loading ? "Loading…" : `At most 5,000 newest rows per table are loaded per request.`}</p>
  </section>;
}

const Bars = ({ data }: { data: [string, number][] }) => { const m = Math.max(1, ...data.map(d => d[1])); return <div>{data.map(([k, v]) => <div key={k} style={{ display: "flex", gap: 10, alignItems: "center", margin: "5px 0" }}><span className="muted" style={{ width: 210, flex: "none", fontSize: "var(--t1)", fontFamily: "ui-monospace,monospace" }}>{k}</span><div className="bar" style={{ flex: 1 }}><i style={{ width: `${(v / m) * 100}%` }} /></div><b style={{ width: 28, textAlign: "right" }}>{v}</b></div>)}</div>; };
const count = (a: string[]) => Object.entries(a.reduce<Record<string, number>>((o, k) => (o[k] = (o[k] ?? 0) + 1, o), {})).sort((x, y) => y[1] - x[1]) as [string, number][];
export default function Research() {
  const [log, , r1] = useLog(); const [mem, , r2] = useMemory(); const [study, , r3] = useStudy(); const [ratings, , r4] = useRatings();
  if (!(r1 && r2 && r3 && r4)) return null;
  const g = log.filter(e => e.grade != null); const tg = log.filter(e => e.grade != null && e.targetGrade != null);
  const mae = tg.length ? mean(tg.map(e => Math.abs(e.grade! - e.targetGrade!))) : NaN;
  const byAge = ["6-8", "9-11", "12-14", "15-17"].map(a => [`ages ${a}`, +(mean(g.filter(e => e.age === a).map(e => e.grade!)) || 0).toFixed(1)] as [string, number]);
  const sig = count(log.flatMap(e => e.signals ?? [])); const ad = count(log.flatMap(e => e.adaptations)); const fb = count(log.map(e => e.feedback ?? "none").filter(x => x !== "none")); const models = count(log.map(e => e.model));
  const n = (v: number, d = 1) => Number.isFinite(v) ? v.toFixed(d) : "–";
  return <RoleGate role="researcher"><><div className="eyebrow">Research dashboard</div><h1>What the data says so far</h1>
    <p className="muted" style={{ maxWidth: 680 }}>Device-local measurements are separate from opt-in pseudonymized shared data. Neither collection establishes clinical effectiveness.</p>
    <SharedResearchData />
    <div className="kpi"><div><b>{log.length}</b><span>Logged replies</span></div><div><b>{n(mean(g.map(e => e.grade!)))}</b><span>Mean reading grade</span></div><div><b>{n(mae)}</b><span>Mean grade error vs target</span></div><div><b>{sig.reduce((a, b) => a + b[1], 0)}</b><span>Signals detected</span></div><div><b>{study.length}</b><span>Study responses</span></div><div><b>{ratings.length}</b><span>Local review entries</span></div></div>
    <p className="muted">Device-local review entries are historical and do not authenticate clinician identity. They are separate from protected content-version reviews.</p>
    <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <div className="card"><h2>Reading grade by age profile</h2><Bars data={byAge} /><p className="muted">If adaptation works, grades should rise with age band.</p></div>
      <div className="card"><h2>Adaptation operations</h2>{ad.length ? <Bars data={ad.slice(0, 8)} /> : <p className="muted">No data yet.</p>}</div>
      <div className="card"><h2>User signals</h2>{sig.length ? <Bars data={sig} /> : <p className="muted">No signals yet. Try saying “simpler” or “I don&apos;t understand” in chat.</p>}</div>
      <div className="card"><h2>Feedback and models</h2>{fb.length ? <Bars data={fb} /> : <p className="muted">No feedback yet.</p>}<h3 style={{ marginTop: 14 }}>Answer source</h3><Bars data={models.length ? models : [["none", 0]]} /></div></div>
    <div className="card"><h2>Memory drift</h2><p className="muted">Level shift after each learning event ({mem.events.length} events).</p>{mem.events.length ? <table><tbody>{[...mem.events].reverse().slice(0, 8).map(e => <tr key={e.ts}><td className="muted">{new Date(e.ts).toLocaleTimeString()}</td><td>{e.signals.map(s => <span key={s} className="tagl">{s}</span>)}</td><td>{e.before.levelShift} → {e.after.levelShift}</td></tr>)}</tbody></table> : <p className="muted">None yet.</p>}</div>
    <div className="card"><h2>Hypotheses</h2><ol><li><b>H1</b> Adapted explanations produce higher comprehension than generic ones. <Link href="/study">Run the study</Link></li><li><b>H2</b> Reading grade of replies tracks the target for each age profile (grade error stays small).</li><li><b>H3</b> After “confusing” signals, later replies for that topic are simpler and use more scaffolding.</li><li><b>H4</b> Clinician review ratings can identify content that needs revision. <Link href="/clinician">Review content</Link></li></ol></div></></RoleGate>;
}
