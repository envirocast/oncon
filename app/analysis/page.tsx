"use client";
import { useMemo, useState } from "react";
import { useRatings, useStudy } from "@/lib/store";
import { cohenKappa, compare, groupsFrom, holm, parseCsv } from "@/lib/analyze";
import { kappaLabel } from "@/lib/stats";

const f = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "–"); const pv = (p?: number) => (p == null ? "–" : p < 0.001 ? "< .001" : p.toFixed(3));
type Cmp = ReturnType<typeof compare>;

function Result({ r, unit }: { r: Cmp; unit?: string }) {
  return (<>
    <div className="wrap"><table><thead><tr><th>Group</th><th>n</th><th>Mean{unit ? ` (${unit})` : ""}</th><th>SD</th><th>95% bootstrap CI</th></tr></thead><tbody>
      {[r.a, r.b].map(g => <tr key={g.name}><td>{g.name}</td><td>{g.n}</td><td><b>{f(g.mean)}</b></td><td>{f(g.sd)}</td><td>{f(g.ci[0])} – {f(g.ci[1])}</td></tr>)}</tbody></table></div>
    {r.w ? <p>Difference {f(r.w.diff)} (95% CI {f(r.w.ci[0])} to {f(r.w.ci[1])}). Welch <i>t</i>({f(r.w.df, 1)}) = {f(r.w.t)}, <i>p</i> {pv(r.w.p)}. Cohen&apos;s <i>d</i> {f(r.w.d)}, Hedges&apos; <i>g</i> {f(r.g)}. Mann–Whitney <i>p</i> {pv(r.mw?.p)}.
      {r.w.p < 0.05 ? " The groups differ reliably at α = .05." : " No reliable difference at α = .05."} With this n, the smallest effect detectable at 80% power is d ≈ {f(r.mdes)}.</p> : <p className="muted">Each group needs at least two values with some spread.</p>}
    {r.w && r.mw && Math.sign(r.w.p - 0.05) !== Math.sign(r.mw.p - 0.05) && <div className="callout">The parametric and rank-based tests disagree about significance. Report both and say which was pre-registered.</div>}</>);
}

export default function Analysis() {
  const [study] = useStudy(); const [ratings] = useRatings(); const [tab, setTab] = useState<"study" | "agree" | "csv">("study");
  const [csv, setCsv] = useState(""); const [gi, setGi] = useState(0); const [vi, setVi] = useState(1);
  const sd = useMemo(() => { const g = (c: string) => study.filter(r => r.condition === c); const pr = (c: string) => g(c).map(r => r.score / Math.max(1, r.total));
    return { n: study.length, score: compare({ name: "Adapted", values: pr("adapted") }, { name: "Generic", values: pr("generic") }), rate: compare({ name: "Adapted", values: g("adapted").map(r => r.selfRated) }, { name: "Generic", values: g("generic").map(r => r.selfRated) }), time: compare({ name: "Adapted", values: g("adapted").map(r => r.ms / 1000) }, { name: "Generic", values: g("generic").map(r => r.ms / 1000) }) }; }, [study]);
  const adj = holm([sd.score.w?.p ?? 1, sd.rate.w?.p ?? 1, sd.time.w?.p ?? 1]);
  // Inter-rater agreement: topics rated by at least two different raters.
  const agree = useMemo(() => { const by = new Map<string, typeof ratings>(); ratings.forEach(r => { const k = r.topic; if (!by.has(k)) by.set(k, []); by.get(k)!.push(r); });
    const pairs: { a: typeof ratings[0]; b: typeof ratings[0] }[] = []; by.forEach(rs => { for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) if (rs[i].rater !== rs[j].rater) pairs.push({ a: rs[i], b: rs[j] }); });
    return { n: pairs.length, decision: cohenKappa(pairs.map(p => p.a.decision), pairs.map(p => p.b.decision)), acc: cohenKappa(pairs.map(p => p.a.accuracy), pairs.map(p => p.b.accuracy), true), age: cohenKappa(pairs.map(p => p.a.ageFit), pairs.map(p => p.b.ageFit), true), safety: cohenKappa(pairs.map(p => p.a.safety), pairs.map(p => p.b.safety), true) }; }, [ratings]);
  const parsed = useMemo(() => parseCsv(csv), [csv]); const groups = useMemo(() => (parsed.header.length ? groupsFrom(parsed.rows, gi, vi) : []), [parsed, gi, vi]);
  const cmp = groups.length === 2 ? compare(groups[0], groups[1]) : null;

  return (<>
    <div className="eyebrow">Research · Analysis</div><h1>Analyse your data</h1>
    <p>Statistics for the study you run, with effect sizes, bootstrap intervals and a rank-based check next to every test. Everything runs in this browser; nothing is uploaded.</p>
    <div className="tabs" role="tablist">{([["study", "Comprehension study"], ["agree", "Local review agreement"], ["csv", "Any CSV"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>

    {tab === "study" && (sd.n === 0 ? <div className="card"><h2>No study data yet</h2><p className="muted">Responses collected on the Comprehension study page appear here. That page needs ethics approval before it is used with real participants. Use the <a href="/protocol">protocol page</a> to plan it, and the <a href="/eval">evaluation harness</a> for automated results meanwhile.</p></div> : <>
      <div className="kpi"><div><b>{sd.n}</b><span>Responses</span></div><div><b>{sd.score.a.n}</b><span>Adapted</span></div><div><b>{sd.score.b.n}</b><span>Generic</span></div></div>
      <div className="card"><h2>Primary: proportion correct</h2><Result r={sd.score} /><p className="muted">Holm-adjusted p across the three outcomes: {pv(adj[0])}.</p></div>
      <div className="card"><h2>Self-rated clarity (1–5)</h2><Result r={sd.rate} /><p className="muted">Holm-adjusted p: {pv(adj[1])}.</p></div>
      <div className="card"><h2>Time to finish (seconds)</h2><Result r={sd.time} unit="s" /><p className="muted">Holm-adjusted p: {pv(adj[2])}.</p></div></>)}

    {tab === "agree" && <div className="card"><h2>Agreement in device-local reviews</h2>
      <p className="muted">This historical device-local analysis uses self-entered rater labels and does not verify clinician identity. It is separate from the authenticated content-version review workflow. Cohen&apos;s kappa is between pairs of different labels for the same topic; decisions are categorical and the 1–5 scales use quadratic-weighted kappa. Landis and Koch&apos;s labels are a rough guide only.</p>
      {agree.n === 0 ? <p>Needs at least two raters reviewing the same topic. {ratings.length} review{ratings.length === 1 ? "" : "s"} recorded so far.</p> : <div className="wrap"><table><thead><tr><th>Measure</th><th>Pairs</th><th>Observed agreement</th><th>Kappa</th><th>Reading</th></tr></thead><tbody>
        {([["Decision", agree.decision], ["Accuracy", agree.acc], ["Age fit", agree.age], ["Safety", agree.safety]] as const).map(([l, k]) => <tr key={l}><td>{l}</td><td>{agree.n}</td><td>{k ? f(k.observed) : "–"}</td><td><b>{k ? f(k.kappa) : "–"}</b></td><td>{k ? kappaLabel(k.kappa) : "–"}</td></tr>)}</tbody></table></div>}
      {agree.n > 0 && agree.n < 10 && <p className="muted">Fewer than 10 pairs: kappa is very unstable. Treat as a rough signal.</p>}</div>}

    {tab === "csv" && <div className="card"><h2>Compare two groups in any CSV</h2>
      <p className="muted">Paste a CSV with a header row. Choose the column that names the group and the column with the numeric outcome. Exactly two groups are compared.</p>
      <textarea className="big" value={csv} onChange={e => setCsv(e.target.value)} placeholder={"group,score\nadapted,0.83\ngeneric,0.67\n…"} aria-label="CSV data" style={{ fontFamily: "ui-monospace,monospace", fontSize: ".82rem" }} />
      <div className="row"><label style={{ margin: 0 }}>Group column <select style={{ width: "auto" }} value={gi} onChange={e => setGi(Number(e.target.value))}>{parsed.header.map((h, i) => <option key={i} value={i}>{h}</option>)}</select></label>
        <label style={{ margin: 0 }}>Outcome column <select style={{ width: "auto" }} value={vi} onChange={e => setVi(Number(e.target.value))}>{parsed.header.map((h, i) => <option key={i} value={i}>{h}</option>)}</select></label></div>
      {parsed.header.length > 0 && groups.length !== 2 && <p className="callout" style={{ marginTop: 14 }}>Found {groups.length} group{groups.length === 1 ? "" : "s"} ({groups.map(g => `${g.name || "blank"}: ${g.values.length}`).join(", ") || "none"}). Pick columns that give exactly two.</p>}
      {cmp && <div style={{ marginTop: 14 }}><Result r={cmp} /></div>}</div>}
  </>);
}
