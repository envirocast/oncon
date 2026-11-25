"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Check, CircleCheck, Copy, Download, Info, Minus, Printer, TriangleAlert, X } from "lucide-react";
import { useLog, useProfile } from "@/lib/store";
import { useChat } from "@/lib/chat";
import { SIGNAL_LABEL, adaptLabel, aggregateLog, buildReport, checks, fmt, heat, reportMarkdown, type AllData, type CheckState, type ReportData, type Turn } from "@/lib/report";

const download = (name: string, body: string, type: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([body], { type })); a.download = name; a.click(); };
const BADGE: Record<string, string> = { adapted: "adapted", triggered: "rule fired", skipped: "skipped", ok: "ran" };
const BAND_TARGET: [string, number][] = [["6-8", 3], ["9-11", 5.5], ["12-14", 8], ["15-17", 11]];
const TONE = { good: { I: CircleCheck, label: "Good" }, note: { I: Info, label: "Note" }, warn: { I: TriangleAlert, label: "Check" } } as const;

/** Key findings, written from the measurements. Each has an icon and a word as well as a colour. */
function Findings({ d }: { d: ReportData }) {
  if (!d.insights.length) return null;
  return (<ul className="finds">{d.insights.map((f, i) => { const T = TONE[f.tone]; return <li key={i} className={"t-" + f.tone}><T.I size={18} aria-hidden /><div><span className="fl">{T.label}</span><p>{f.text}</p></div></li>; })}</ul>);
}

/** The four age-band target zones, one row each, with where the real answers landed on the same grade scale underneath. */
function Ladder({ turns }: { turns: Turn[] }) {
  const pts = turns.filter(t => t.grade != null); if (!pts.length) return null;
  const W = 720, L = 96, R = 24, max = 14, ROW = 30, top = 8; const x = (g: number) => L + (Math.min(Math.max(g, 0), max) / max) * (W - L - R);
  const base = top + BAND_TARGET.length * ROW + 16; const spread = pts.map((t, i) => ({ t, row: pts.slice(0, i).filter(o => Math.abs(x(o.grade!) - x(t.grade!)) < 22).length })); const H = base + 40 + Math.max(...spread.map(s => s.row)) * 22 + 28;
  return (<figure className="rfig"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Where each answer landed on the reading-grade scale, against the target zone for each age band">
    {Array.from({ length: 8 }, (_, i) => i * 2).map(g => <line key={g} x1={x(g)} x2={x(g)} y1={top} y2={base + 8} className="gl" />)}
    {BAND_TARGET.map(([age, tg], i) => { const y = top + i * ROW; return <g key={age}><text x={L - 12} y={y + ROW / 2 + 4} textAnchor="end" className="ax">Ages {age}</text><rect x={x(tg - 2)} y={y + 6} width={x(tg + 2) - x(tg - 2)} height={ROW - 12} rx="8" className="zone" /><line x1={x(tg)} x2={x(tg)} y1={y + 4} y2={y + ROW - 4} className="tgt solid" /></g>; })}
    <text x={L - 12} y={base + 30} textAnchor="end" className="ax">Answers</text>
    {spread.map(({ t, row }) => <g key={t.id}><line x1={x(t.grade!)} x2={x(t.grade!)} y1={top} y2={base + 20 + row * 22} className="drop" /><circle cx={x(t.grade!)} cy={base + 26 + row * 22} r="10" className="dot" /><text x={x(t.grade!)} y={base + 30 + row * 22} textAnchor="middle" className="pn">{t.n}</text></g>)}
    {Array.from({ length: 8 }, (_, i) => i * 2).map(g => <text key={g} x={x(g)} y={H - 6} textAnchor="middle" className="ax">{g}</text>)}
  </svg><figcaption><span className="k"><i className="sw bandsw" />Target zone (±2 grades)</span><span className="k"><i className="sw tick" />Band target</span><span className="k">Numbered dots are replies, placed at their measured grade</span></figcaption></figure>);
}

/** Each answer's grade next to its target, with the ±2 band. Squares mark answers outside the band. */
function LevelChart({ turns }: { turns: Turn[] }) {
  const W = 720, H = 280, L = 44, R = 20, T = 20, B = 40; const pts = turns.filter(t => t.grade != null && t.target != null);
  if (!pts.length) return <p className="muted">No English answers with a measured reading grade yet.</p>;
  const max = Math.max(14, Math.ceil(Math.max(...pts.map(t => Math.max(t.grade!, t.target! + 2))) + 1)); const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const x = (i: number) => (pts.length === 1 ? (L + W - R) / 2 : L + (i / (pts.length - 1)) * (W - L - R)); const half = pts.length === 1 ? 56 : 0;
  const hi = pts.map((t, i) => `${x(i) - half},${y(t.target! + 2)}`), lo = pts.map((t, i) => `${x(i) - half},${y(Math.max(0, t.target! - 2))}`);
  const band = pts.length === 1 ? `${x(0) - half},${y(pts[0].target! + 2)} ${x(0) + half},${y(pts[0].target! + 2)} ${x(0) + half},${y(Math.max(0, pts[0].target! - 2))} ${x(0) - half},${y(Math.max(0, pts[0].target! - 2))}` : [...hi, ...lo.reverse()].join(" ");
  const ticks = Array.from({ length: Math.floor(max / 2) + 1 }, (_, i) => i * 2);
  return (<figure className="rfig"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Measured reading grade against target for ${pts.length} answers`}>
    {ticks.map(g => <g key={g}><line x1={L} x2={W - R} y1={y(g)} y2={y(g)} className="gl" /><text x={L - 10} y={y(g) + 4} textAnchor="end" className="ax">{g}</text></g>)}
    <polygon points={band} className="band" />
    {pts.length > 1 && <polyline points={pts.map((t, i) => `${x(i)},${y(t.target!)}`).join(" ")} className="tgt" />}
    {pts.length === 1 && <line x1={x(0) - half} x2={x(0) + half} y1={y(pts[0].target!)} y2={y(pts[0].target!)} className="tgt" />}
    {pts.length > 1 && <polyline points={pts.map((t, i) => `${x(i)},${y(t.grade!)}`).join(" ")} className="meas" />}
    {pts.map((t, i) => <g key={t.id}>{t.within ? <circle cx={x(i)} cy={y(t.grade!)} r="5.5" className="dot" /> : <rect x={x(i) - 5.5} y={y(t.grade!) - 5.5} width="11" height="11" className="dot out" />}
      <text x={x(i)} y={y(t.grade!) - 13} textAnchor="middle" className="val">{t.grade}</text><text x={x(i)} y={H - 14} textAnchor="middle" className="ax">Reply {t.n}</text></g>)}
  </svg><figcaption><span className="k"><i className="sw dot" />Measured grade</span><span className="k"><i className="sw sq" />Outside the band</span><span className="k"><i className="sw bandsw" />Target ±2 grades</span><span className="k"><i className="sw dash" />Target</span></figcaption></figure>);
}

function Mini({ label, hint, values, min, max }: { label: string; hint: string; values: number[]; min: number; max: number }) {
  const W = 220, H = 84, P = 12; const x = (i: number) => (values.length === 1 ? W / 2 : P + (i / (values.length - 1)) * (W - 2 * P)); const y = (v: number) => H - P - ((v - min) / (max - min)) * (H - 2 * P); const last = values.at(-1) ?? 0;
  return (<div className="mini"><div className="mh"><span>{label}</span><b>{fmt(last)}</b></div>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} across ${values.length} replies, ending at ${last}`}><line x1={P} x2={W - P} y1={y(0)} y2={y(0)} className="gl" />
      {values.length > 1 && <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} className="meas" />}{values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 4.5 : 3} className="dot" />)}</svg>
    <p className="muted">{hint}</p></div>);
}

/** The answer itself, with each sentence shaded by how hard it is for the target reader. Hard sentences are underlined as well as shaded. */
function Heat({ t }: { t: Turn }) {
  const paras = useMemo(() => heat(t.reply.text, t.target), [t]);
  return (<div className="heat">{paras.map((p, i) => <p key={i}>{p.map((s, j) => <span key={j} className={"h" + s.level} title={`Grade ${s.grade} · ${s.words} words`}>{s.text} </span>)}</p>)}
    <div className="hleg"><span><i className="h0" />Near or below target</span><span><i className="h1" />A little hard</span><span><i className="h2" />Hard for this reader</span></div></div>);
}

/** Same question, four readers: what the built-in engine writes at each age band, and what chat memory changed. */
function Readers({ t }: { t: Turn }) {
  const c = t.compare; if (!c) return <p className="muted">Comparison needs an English question.</p>; const max = 14;
  return (<div className="readers"><div className="rh">Same question at each age band <span className="muted">(built-in engine preview)</span></div>
    {c.readers.map(r => <div key={r.age} className={"rrow" + (r.actual ? " on" : "")}><span className="ra">Ages {r.age}{r.actual && <em>used</em>}</span>
      <span className="rbar" role="img" aria-label={`Grade ${r.grade}, target ${r.target}`}><i style={{ width: `${Math.min(100, (r.grade / max) * 100)}%` }} />{r.target != null && <b style={{ left: `${(r.target / max) * 100}%` }} />}</span><span className="rv">{r.grade}<small> / {r.words}w</small></span></div>)}
    <div className="rleg">Bar is the measured grade, the tick is that band&apos;s target. {c.noMemory ? <>Without chat memory the engine would have used ages {c.noMemory.level}: grade {c.noMemory.grade}, {c.noMemory.words} words.</> : "Chat memory had not moved yet, so memory made no difference here."}</div></div>);
}

const ICON: Record<CheckState, { I: typeof Check; t: string }> = { yes: { I: Check, t: "Yes" }, no: { I: X, t: "No" }, na: { I: Minus, t: "n/a" }, note: { I: Info, t: "Noted" } };
function ChecksMatrix({ turns }: { turns: Turn[] }) {
  const all = turns.map(t => checks(t)); const rows = all[0].map(c => c.id);
  return (<div className="wrap"><table className="cm"><thead><tr><th>Check</th>{turns.map(t => <th key={t.id}>Reply {t.n}</th>)}</tr></thead><tbody>
    {rows.map((id, ri) => <tr key={id}><td>{all[0][ri].label}</td>{all.map((cs, ci) => { const c = cs[ri]; const I = ICON[c.state].I; return <td key={ci} title={c.detail}><span className={"cs " + c.state}><I size={15} aria-hidden />{ICON[c.state].t}</span></td>; })}</tr>)}</tbody></table></div>);
}

function Stepper({ t }: { t: Turn }) {
  const steps = t.reply.trace ?? []; if (!steps.length) return <p className="muted">This answer was saved before traces existed.</p>;
  return (<ol className="rsteps">{steps.map(s => <li key={s.n} className={s.status}><div className="sh"><span className="sn">{String(s.n).padStart(2, "0")}</span><b>{s.name.replaceAll("_", " ").toLowerCase()}</b><span className="badge">{BADGE[s.status]}</span></div><div className="call">{s.call}</div><div className="res">{s.result}</div></li>)}</ol>);
}

function Bars({ rows, max }: { rows: [string, number, string?][]; max?: number }) {
  const m = max ?? Math.max(1, ...rows.map(r => r[1]));
  return (<div className="bars">{rows.map(([k, v, note]) => <div key={k} className="brow"><span className="bk">{k}</span><span className="bt"><i style={{ width: `${Math.max(2, (v / m) * 100)}%` }} /></span><span className="bv">{v}{note && <small> {note}</small>}</span></div>)}</div>);
}

function Actions({ d, title, json }: { d: ReportData; title: string; json: () => void }) {
  const [copied, setCopied] = useState(false); const md = () => reportMarkdown(d, title);
  return (<div className="actions"><button className="btn" onClick={() => window.print()}><Printer size={15} />Print or save as PDF</button><button className="btn alt" onClick={() => download("onconnect-session-report.md", md(), "text/markdown")}><Download size={15} />Markdown</button>
    <button className="btn alt" onClick={json}><Download size={15} />Data (JSON)</button><button className="btn alt" onClick={async () => { try { await navigator.clipboard.writeText(md()); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy summary"}</button></div>);
}

function Conversation({ d, title }: { d: ReportData; title: string }) {
  const [open, setOpen] = useState<string | null>(d.turns.at(-1)?.id ?? null); const [trace, setTrace] = useState<string | null>(null); const stamp = useMemo(() => new Date().toLocaleString(), []);
  const json = () => download("onconnect-session-report.json", JSON.stringify({ generated: new Date().toISOString(), profile: d.profile, headline: d.headline, findings: d.insights, turns: d.turns.map(t => ({ n: t.n, question: t.question, topic: t.reply.topicId, model: t.reply.model, promptVersion: t.reply.promptVersion, mode: t.reply.mode, lang: t.reply.lang,
    targetGrade: t.target, measuredGrade: t.grade, words: t.words, maxWords: t.maxWords, coverage: t.reply.coverage, signals: t.signals, memory: t.mem, adaptations: t.reply.adaptations, safety: t.reply.safety, source: t.reply.source, references: t.reply.references ?? [], checks: checks(t), trace: t.reply.trace })) }, null, 2), "application/json");
  const pct = d.graded ? Math.round((d.within / d.graded) * 100) : null; const fb = Object.entries(d.feedback);
  const references = [...new Map(d.turns.flatMap(t => t.reply.references ?? []).map(ref => [ref.id, ref] as const)).values()];
  return (<>
    <header className="rhead"><div className="eyebrow">Session report</div><h1>{title}</h1><p className="lede">{d.headline}</p>
      <div className="meta"><span>{stamp}</span><span>Ages {d.profile.age}, {d.profile.detail} detail</span><span>{d.models.map(m => m === "onconnect-templates" ? "built-in templates" : m).join(", ")}</span></div>
      <Actions d={d} title={title} json={json} />
      <nav className="toc2" aria-label="On this page">{[["#numbers", "Numbers"], ["#findings", "Findings"], ["#level", "Reading level"], ["#answers", "Each answer"], ["#memory", "Memory"], ["#algo", "Algorithm"], ["#checks", "Checks"], ["#prov", "Provenance"], ["#learn", "Learning"], ["#limits", "Limits"]].map(([h, l]) => <a key={h} href={h}>{l}</a>)}</nav></header>

    {d.offlineTurns > 0 && <div className="callout"><b>{d.offlineTurns === d.turns.length ? "These answers came from the built-in template engine, not the AI model." : `${d.offlineTurns} of ${d.turns.length} answers came from the built-in template engine, not the AI model.`}</b> The model was unavailable at the time, so wording is less flexible and reading levels are less precise.</div>}

    <section id="numbers" className="rsec"><div className="nums">
      <div><b>{d.turns.length}</b><span>Answers</span></div><div><b>{pct == null ? "n/a" : `${pct}%`}</b><span>Within 2 grades of target{d.graded ? ` (${d.within} of ${d.graded})` : ""}</span></div><div><b>{d.meanGap ?? "n/a"}</b><span>Average grade gap</span></div>
      <div><b>{d.adaptations.length}</b><span>Kinds of adaptation</span></div><div><b>{fmt(d.end.levelShift)}</b><span>Level shift now (start {fmt(d.start.levelShift)})</span></div><div><b>{d.meanWords ?? "n/a"}</b><span>Average words per answer</span></div></div></section>

    <section id="findings" className="rsec"><h2>Key findings</h2><p className="sub">Written from the measurements below. Nothing here is estimated or assumed.</p><Findings d={d} /></section>

    <section id="level" className="rsec"><h2>Reading level</h2>
      <p className="sub">Each age profile has a target reading grade. The shaded zones show where each age band aims, and the points show where the real answers landed.</p>
      <Ladder turns={d.turns} /><h3 className="h3">Against each answer&apos;s own target</h3><LevelChart turns={d.turns} />
      <div className="wrap"><table><thead><tr><th>Reply</th><th>Topic</th><th>Target</th><th>Measured</th><th>Gap</th><th>Words</th><th>Coverage</th></tr></thead><tbody>
        {d.turns.map(t => <tr key={t.id}><td>{t.n}</td><td>{t.reply.topicId ?? "general"}</td><td>{t.target ?? "n/a"}</td><td>{t.grade ?? "n/a"}</td><td>{t.gap == null ? "n/a" : <>{t.gap.toFixed(1)} <span className="muted">{t.within ? "inside" : "outside"}</span></>}</td>
          <td>{t.words ?? "n/a"}{t.maxWords ? <span className="muted"> / {t.maxWords}</span> : null}</td><td>{t.reply.coverage != null ? `${Math.round(t.reply.coverage * 100)}%` : "n/a"}</td></tr>)}</tbody></table></div></section>

    <section id="answers" className="rsec"><h2>Each answer, up close</h2><p className="sub">What the reader said, how the memory moved, the answer with every sentence graded against the target, and how other readers would have been answered.</p>
      <div className="acc">{d.turns.map(t => <div key={t.id} className={"accitem" + (open === t.id ? " open" : "")}>
        <button className="acch" aria-expanded={open === t.id} onClick={() => setOpen(o => (o === t.id ? null : t.id))}><span className="tn">{t.n}</span><span className="accq">{t.question || "Reply " + t.n}</span><span className="muted">{t.grade != null && t.target != null ? `grade ${t.grade} / target ${t.target}` : "not graded"}</span></button>
        {open === t.id && <div className="accbody">
          <div className="chips2">{t.signals.length ? t.signals.map(s => <span key={s} className="sig">{SIGNAL_LABEL[s]}</span>) : <span className="muted">No feedback signal</span>}
            {(["levelShift", "lengthBias", "scaffold"] as const).map(k => t.delta[k] !== 0 && <span key={k} className="dl">{k === "levelShift" ? "Level" : k === "lengthBias" ? "Length" : "Support"} {fmt(t.delta[k])} <i>now {fmt(t.mem[k])}</i></span>)}</div>
          <div className="two"><div><div className="rh">The answer, sentence by sentence</div><Heat t={t} /></div><div><Readers t={t} /></div></div>
          <div className="rh">Adaptations applied</div><ul className="plain">{t.reply.adaptations.length ? t.reply.adaptations.map(a => <li key={a}>{adaptLabel(a)}</li>) : <li className="muted">No adaptations applied</li>}</ul></div>}</div>)}</div></section>

    <section id="memory" className="rsec"><h2>How the memory moved</h2><p className="sub">A small model of how this reader responds. Saying “simpler” or “I don&apos;t get it” moves it, and it carries into later answers.</p>
      <div className="minis"><Mini label="Level shift" hint="Reading level up (+) or down (−) from the age band." values={d.turns.map(t => t.mem.levelShift)} min={-2} max={2} /><Mini label="Length bias" hint="Longer (+) or shorter (−) answers." values={d.turns.map(t => t.mem.lengthBias)} min={-2} max={2} />
        <Mini label="Scaffolding" hint="Extra support: short sentences, examples, steps." values={d.turns.map(t => t.mem.scaffold)} min={0} max={3} /></div></section>

    <section id="algo" className="rsec"><h2>The algorithm, step by step</h2><p className="sub">What actually ran for each answer, with its real inputs and results. “Adapted” steps changed the answer. “Rule fired” steps are safety or validation rules that triggered.</p>
      <div className="acc">{d.turns.map(t => <div key={t.id} className={"accitem" + (trace === t.id ? " open" : "")}><button className="acch" aria-expanded={trace === t.id} onClick={() => setTrace(o => (o === t.id ? null : t.id))}>
        <span className="tn">{t.n}</span><span className="accq">{t.question || "Reply " + t.n}</span><span className="muted">{(t.reply.trace ?? []).length} steps · {t.reply.model === "onconnect-templates" || !t.reply.model ? "templates" : t.reply.model}</span></button>{trace === t.id && <Stepper t={t} />}</div>)}</div></section>

    <section id="checks" className="rsec"><h2>Quality checks</h2><p className="sub">Seven automatic checks per answer. “n/a” means the check did not apply, and “noted” means a rule fired and handled the answer. Hover a cell for the detail.</p><ChecksMatrix turns={d.turns} />
      {d.safeguards.length > 0 && <><h3 className="h3">Rules that fired</h3><ul className="plain">{d.safeguards.map((s, i) => <li key={i}><b>Reply {s.turn}, {s.name.replaceAll("_", " ").toLowerCase()}.</b> {s.result}</li>)}</ul></>}
      {d.regenerated > 0 && <p className="muted">{d.regenerated} {d.regenerated === 1 ? "answer was" : "answers were"} regenerated once because the first attempt was off target.</p>}</section>

    <section id="prov" className="rsec"><h2>Provenance</h2><p className="sub">Enough detail to reproduce or audit each answer.</p>
      <div className="wrap"><table><thead><tr><th>Reply</th><th>Model</th><th>Prompt</th><th>Mode</th><th>Language</th><th>Source</th><th>Time</th></tr></thead><tbody>
        {d.turns.map(t => <tr key={t.id}><td>{t.n}</td><td>{t.reply.model ?? "templates"}</td><td>{t.reply.promptVersion ?? "n/a"}</td><td>{t.reply.mode ?? "adaptive"}</td><td>{t.reply.lang ?? "en"}</td><td>{t.reply.source ?? "none"}
          {t.reply.references && <ul className="plain">{t.reply.references.map(ref => <li key={ref.id}><a href={ref.url} target="_blank" rel="noreferrer">{ref.title}</a><div className="muted">{ref.publisher}</div></li>)}</ul>}</td>
          <td>{t.reply.ts ? new Date(t.reply.ts).toLocaleTimeString() : "n/a"}</td></tr>)}</tbody></table></div></section>

    <section id="learn" className="rsec"><h2>Learning summary</h2>
      {d.glossary.length ? <dl className="gloss">{d.glossary.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl> : <p className="muted">No glossary terms were introduced.</p>}
      <p className="muted">Reading a topic does not mean it was mastered, so understanding was not assessed.</p>
      {references.length > 0 && <><h3 className="h3">Sources linked in these answers</h3><ul className="plain">{references.map(ref => <li key={ref.id}><a href={ref.url} target="_blank" rel="noreferrer">{ref.title}</a> — {ref.publisher}</li>)}</ul></>}
      <h3 className="h3">Feedback given</h3><p>{fb.length ? fb.map(([k, v]) => `${k} ×${v}`).join(", ") : "No feedback given."}</p></section>

    <section id="limits" className="rsec"><h2>Limits of this report</h2>
      <ul className="plain"><li>Reading grade uses the Flesch–Kincaid formula and works for English only. Per-sentence grades are noisy for short sentences. Coverage is a keyword heuristic. None is a clinical measure.</li>
        <li>The age-band comparison is produced by the built-in engine for the same question. It shows how wording scales, not what the AI model would have written.</li><li>Memory updates come from keyword rules, not a validated psychological model.</li>
        <li>No diagnosis was verified and no emotional or psychological assessment was made. This is general education, not advice about anyone&apos;s own care.</li></ul>
      <Link href="/method" className="textlink2">Read the full method <ArrowRight size={14} /></Link> <Link href="/eval" className="textlink2">Run the evaluation harness <ArrowRight size={14} /></Link></section>
    <p className="printfoot">Onconnect session report · {stamp} · General education only, not advice about your own care.</p>
  </>);
}

/** Everything in the audit log, across all conversations on this device. */
function AllView({ a }: { a: AllData }) {
  const pct = a.graded ? Math.round((a.within / a.graded) * 100) : null;
  if (!a.n) return <header className="rhead"><div className="eyebrow">All conversations</div><h1>Across every conversation</h1><p className="lede">The audit log is empty. Ask a few questions and this view will show how well the reading levels held up across all of them.</p><div className="actions"><Link href="/chat" className="btn">Start a conversation <ArrowRight size={15} /></Link></div></header>;
  const rate = a.rolling.at(-1)?.rate; const W = 720, H = 140, L = 36, R = 16, T = 12, B = 28; const x = (i: number) => (a.rolling.length === 1 ? (L + W - R) / 2 : L + ((i - 1) / (a.rolling.length - 1)) * (W - L - R)); const y = (v: number) => T + (1 - v) * (H - T - B);
  return (<>
    <header className="rhead"><div className="eyebrow">All conversations</div><h1>Across every conversation</h1>
      <p className="lede">{a.n} {a.n === 1 ? "answer" : "answers"} logged on this device{a.first ? `, from ${new Date(a.first).toLocaleDateString()} to ${new Date(a.last!).toLocaleDateString()}` : ""}.{pct != null ? ` ${pct}% of the ${a.graded} measured answers landed within two grades of their target.` : ""}</p>
      <div className="actions"><button className="btn" onClick={() => window.print()}><Printer size={15} />Print or save as PDF</button><button className="btn alt" onClick={() => download("onconnect-all-sessions.json", JSON.stringify(a, null, 2), "application/json")}><Download size={15} />Data (JSON)</button></div></header>
    {a.offline > 0 && <div className="callout"><b>{a.offline} of {a.n} logged answers came from the template engine, not the AI model.</b> They are included here and marked in the model table below.</div>}
    <section className="rsec"><div className="nums"><div><b>{a.n}</b><span>Answers logged</span></div><div><b>{pct == null ? "n/a" : `${pct}%`}</b><span>Within 2 grades of target</span></div><div><b>{a.meanGap ?? "n/a"}</b><span>Average grade gap</span></div>
      <div><b>{a.adapt.length}</b><span>Kinds of adaptation used</span></div><div><b>{a.signals.reduce((s, [, n]) => s + n, 0)}</b><span>Feedback signals detected</span></div><div><b>{a.safety}</b><span>Safety rules fired</span></div></div></section>
    {a.byAge.length > 0 && <section className="rsec"><h2>Accuracy by age band</h2><p className="sub">Average distance between the measured reading grade and the target, by the age band the reader chose. Smaller is better.</p>
      <Bars rows={a.byAge.map(r => [`Ages ${r.age}`, r.gap, `grade gap · ${r.within}/${r.n} inside the band`] as [string, number, string])} max={Math.max(4, ...a.byAge.map(r => r.gap))} /></section>}
    {a.rolling.length > 1 && <section className="rsec"><h2>Is it getting better?</h2><p className="sub">Share of answers inside the band, over a rolling window of the latest five answers.</p>
      <figure className="rfig"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Rolling share of answers within two grades of target">{[0, 0.5, 1].map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="gl" /><text x={L - 8} y={y(v) + 4} textAnchor="end" className="ax">{Math.round(v * 100)}%</text></g>)}
        <polyline points={a.rolling.map(r => `${x(r.i)},${y(r.rate)}`).join(" ")} className="meas" />{a.rolling.map(r => <circle key={r.i} cx={x(r.i)} cy={y(r.rate)} r={r.i === a.rolling.length ? 4.5 : 2.5} className="dot" />)}</svg>
        <figcaption><span className="k">Latest: {Math.round((rate ?? 0) * 100)}% inside the band</span><span className="k">{a.rolling.length} measured answers</span></figcaption></figure></section>}
    <section className="rsec"><h2>What the adaptation did</h2><p className="sub">How often each adaptation was applied, and which feedback signals the readers gave.</p>
      <div className="two"><div><div className="rh">Adaptations</div><Bars rows={a.adapt.slice(0, 8).map(([k, v]) => [adaptLabel(k), v] as [string, number])} /></div>
        <div><div className="rh">Signals from readers</div>{a.signals.length ? <Bars rows={a.signals.map(([k, v]) => [SIGNAL_LABEL[k as keyof typeof SIGNAL_LABEL] ?? k, v] as [string, number])} /> : <p className="muted">No feedback signals yet.</p>}</div></div></section>
    <section className="rsec"><h2>Sources of the answers</h2><div className="two"><div><div className="rh">Model</div><Bars rows={a.models.map(([k, v]) => [k === "onconnect-templates" ? "Built-in templates" : k, v] as [string, number])} /></div><div><div className="rh">Mode</div><Bars rows={a.modes.map(([k, v]) => [k, v] as [string, number])} /></div></div></section>
    <section className="rsec"><h2>Limits</h2><ul className="plain"><li>These are the reader&apos;s own logged answers on this device. They are a convenience sample, not a study. For evidence about the method, use the <Link href="/eval">evaluation harness</Link> and a properly designed <Link href="/protocol">protocol</Link>.</li><li>Reading grade is Flesch–Kincaid, English only, and not a clinical measure.</li></ul></section>
    <p className="printfoot">Onconnect, all conversations · General education only, not advice about your own care.</p>
  </>);
}

export default function ReportPage() {
  const { active, convos, select, ready } = useChat(); const [profile] = useProfile(); const [log] = useLog(); const [scope, setScope] = useState<"one" | "all">("one");
  const withReplies = convos.filter(c => c.msgs.some(m => m.reply));
  const conv = active && active.msgs.some(m => m.reply) ? active : withReplies[0];
  const d = useMemo(() => buildReport(conv?.msgs ?? [], profile), [conv, profile]); const a = useMemo(() => aggregateLog(log), [log]);
  if (!ready) return null;
  const tabs = (<div className="rtabs" role="tablist" aria-label="Report scope"><button role="tab" aria-selected={scope === "one"} className={scope === "one" ? "on" : ""} onClick={() => setScope("one")}>This conversation</button><button role="tab" aria-selected={scope === "all"} className={scope === "all" ? "on" : ""} onClick={() => setScope("all")}>All conversations</button></div>);
  if (!d.turns.length && scope === "one") return (<div className="rpt">{tabs}<header className="rhead"><div className="eyebrow">Session report</div><h1>How Onconnect adapted this conversation</h1>
    <p className="lede">There is nothing to report yet. Ask a question, say “simpler” or “I don&apos;t get it” once, and the report will show how the reading level and memory moved.</p><div className="actions"><Link href="/chat" className="btn">Start a conversation <ArrowRight size={15} /></Link></div></header></div>);
  return (<div className="rpt">{tabs}
    {scope === "all" ? <AllView a={a} /> : <>
      {withReplies.length > 1 && <div className="rpick"><label htmlFor="conv">Conversation</label><select id="conv" value={conv?.id ?? ""} onChange={e => select(e.target.value)}>{withReplies.map(c => <option key={c.id} value={c.id}>{c.title || "New chat"} · {new Date(c.ts).toLocaleDateString()}</option>)}</select></div>}
      <Conversation key={conv?.id} d={d} title={conv?.title ? `“${conv.title}”` : "How Onconnect adapted this conversation"} /></>}
  </div>);
}
