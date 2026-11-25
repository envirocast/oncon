// Builds the session report from a conversation. Pure functions: every number shown in the report comes from the saved replies, nothing is invented.
import type { LogEvent, Msg } from "./store";
import { respond, type Profile, type Reply } from "./engine";
import { DEFAULT_MEMORY } from "./memory";
import { metrics } from "./metrics";
import type { Signal, Snap } from "./memory";
import { GLOSSARY, TOPICS } from "./content";

export const SIGNAL_LABEL: Record<Signal, string> = { CONFUSED: "Said it was confusing", SIMPLER: "Asked for simpler", MORE_DETAIL: "Asked for more detail", SHORTER: "Asked for shorter", LONGER: "Asked for longer", UNDERSTOOD: "Said they understood", WANTS_EXAMPLE: "Wanted an example", WANTS_STEPS: "Wanted steps" };
export const ADAPT_LABEL: Record<string, string> = {
  DEVELOPMENTAL_ADAPTATION: "Adjusted complexity to the age profile", VOCABULARY_DEFINED: "Defined unfamiliar medical words", STEPWISE_EXPLANATION: "Used step-by-step explanations",
  EXAMPLE_ADDED: "Added familiar comparisons", SHORT_FORMAT: "Kept the explanation short", SIMPLIFIED_ON_REQUEST: "Simplified when asked", EXPANDED_ON_REQUEST: "Added detail when asked",
  MEMORY_SIMPLIFIED: "Used chat memory to lower the level", MEMORY_EXPANDED: "Used chat memory to raise the level", CONFUSION_SCAFFOLDING: "Added extra support after confusion", ALTERNATE_STRATEGY: "Switched to a different explanation approach",
  SAFETY_INDIVIDUAL_ADVICE_REDIRECT: "Pointed a personal medical question to the care team", SAFETY_SUPPORT_REDIRECT: "Encouraged talking to a trusted adult",
};
export const adaptLabel = (a: string) => ADAPT_LABEL[a] ?? a.toLowerCase().replaceAll("_", " ");

export interface Turn {
  n: number; id: string; question: string; reply: Reply;
  grade: number | null; target: number | null; gap: number | null; within: boolean | null; words: number | null; maxWords: number | null;
  signals: Signal[]; mem: Snap; delta: Snap; offline: boolean; feedback?: Msg["feedback"]; compare: Compare | null;
}
export interface Safeguard { turn: number; name: string; result: string; }
export interface ReportData {
  turns: Turn[]; asked: number; topics: { id: string; title: string }[]; terms: string[]; glossary: [string, string][]; sources: string[]; adaptations: string[];
  graded: number; within: number; meanGap: number | null; meanWords: number | null; start: Snap; end: Snap; models: string[]; offlineTurns: number; regenerated: number;
  safeguards: Safeguard[]; feedback: Record<string, number>; headline: string; profile: Profile; insights: Insight[];
}

const snap = (m?: Snap): Snap => ({ levelShift: m?.levelShift ?? 0, lengthBias: m?.lengthBias ?? 0, scaffold: m?.scaffold ?? 0 });
const diff = (a: Snap, b: Snap): Snap => ({ levelShift: a.levelShift - b.levelShift, lengthBias: a.lengthBias - b.lengthBias, scaffold: a.scaffold - b.scaffold });
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);
const uniq = <T,>(xs: T[]) => [...new Set(xs)];
const join = (xs: string[]) => (xs.length <= 1 ? xs.join("") : xs.length === 2 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

export function buildReport(msgs: Msg[], profile: Profile): ReportData {
  const turns: Turn[] = []; let lastUser = ""; let prev: Snap | null = null;
  for (const m of msgs) {
    if (m.role === "user") { lastUser = m.text; continue; }
    const r = m.reply; if (!r) continue;
    const mem = snap(r.memory); const english = (r.lang ?? "en") === "en";
    const grade = english && r.metrics ? r.metrics.grade : null; const target = r.plan?.targetGrade ?? null;
    const gap = grade != null && target != null ? Math.abs(grade - target) : null;
    const before = prev ?? snap(r.memory?.events?.at(-1)?.before);
    turns.push({ n: turns.length + 1, id: m.id, question: lastUser, reply: r, grade, target, gap, within: gap == null ? null : gap <= 2, words: r.metrics?.words ?? null, maxWords: r.plan?.maxWords ?? null,
      signals: r.signals ?? [], mem, delta: diff(mem, before), offline: (r.model ?? "onconnect-templates") === "onconnect-templates", feedback: m.feedback,
      compare: english ? compare(lastUser, turns.at(-1)?.reply.topicId ?? null, profile, r.plan?.level, mem.levelShift !== 0 || mem.lengthBias !== 0 || mem.scaffold !== 0) : null });
    prev = mem;
  }
  const graded = turns.filter(t => t.gap != null); const within = graded.filter(t => t.within).length;
  const topics = uniq(turns.map(t => t.reply.topicId).filter(Boolean) as string[]).map(id => ({ id, title: TOPICS.find(t => t.id === id)?.title ?? id }));
  const terms = uniq(topics.flatMap(t => TOPICS.find(x => x.id === t.id)?.terms ?? []));
  const safeguards: Safeguard[] = turns.flatMap(t => (t.reply.trace ?? []).filter(s => s.status === "triggered").map(s => ({ turn: t.n, name: s.name, result: s.result })));
  const regenerated = turns.filter(t => (t.reply.trace ?? []).some(s => /regenerat/i.test(s.result))).length;
  const feedback: Record<string, number> = {}; turns.forEach(t => { if (t.feedback) feedback[t.feedback] = (feedback[t.feedback] ?? 0) + 1; });
  const start = turns[0] ? diff(turns[0].mem, turns[0].delta) : snap(); const end = turns.at(-1)?.mem ?? snap();
  const meanGap = r1(mean(graded.map(t => t.gap!))); const meanWords = r1(mean(turns.map(t => t.words).filter((x): x is number => x != null)));

  // plain-language headline, assembled only from measured facts
  const parts: string[] = [];
  parts.push(`${turns.length} ${turns.length === 1 ? "answer" : "answers"} on ${topics.length ? join(topics.map(t => t.title.toLowerCase())) : "general questions"}.`);
  if (graded.length) parts.push(`${within} of ${graded.length} landed within two grades of the target reading level${meanGap != null ? ` (average gap ${meanGap} grades)` : ""}.`);
  const sig = turns.flatMap(t => t.signals);
  if (sig.length) parts.push(end.levelShift !== start.levelShift ? `After the reader ${join(uniq(sig).map(s => SIGNAL_LABEL[s].toLowerCase()))}, the reading level shifted from ${fmt(start.levelShift)} to ${fmt(end.levelShift)}.` : `Signals detected: ${join(uniq(sig).map(s => SIGNAL_LABEL[s].toLowerCase()))}.`);
  else parts.push("No feedback signals were detected, so the level stayed at the profile's starting point.");
  const safety = safeguards.filter(x => x.name !== "VALIDATE" && x.name !== "OUTPUT_GUARD"); const flagged = safeguards.filter(x => x.name === "VALIDATE").length;
  if (safety.length) parts.push(`${safety.length} safety ${safety.length === 1 ? "rule" : "rules"} fired.`);
  if (flagged) parts.push(`The reading-level validator flagged ${flagged} ${flagged === 1 ? "answer" : "answers"} as off target.`);

  const d: ReportData = { turns, asked: msgs.filter(m => m.role === "user").length, topics, terms, glossary: terms.filter(t => GLOSSARY[t]).map(t => [t, GLOSSARY[t]] as [string, string]),
    sources: uniq(turns.map(t => t.reply.source).filter(Boolean) as string[]), adaptations: uniq(turns.flatMap(t => t.reply.adaptations)), graded: graded.length, within, meanGap, meanWords, start, end,
    models: uniq(turns.map(t => t.reply.model ?? "onconnect-templates")), offlineTurns: turns.filter(t => t.offline).length, regenerated, safeguards, feedback, headline: parts.join(" "), profile, insights: [] };
  d.insights = insights(d);
  return d;
}

export const fmt = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

export function reportMarkdown(d: ReportData, title: string): string {
  const L: string[] = [`# Onconnect session report`, `_${title} · generated ${new Date().toLocaleString()} · ages ${d.profile.age}, ${d.profile.detail} detail_`, "", d.headline, "",
    ...(d.insights.length ? ["## Key findings", "", ...d.insights.map(f => `- ${f.text}`), ""] : []), "## Measurements", "", "| Reply | Topic | Target grade | Measured grade | Words | Signals | Level shift | Model |", "|---|---|---|---|---|---|---|---|"];
  d.turns.forEach(t => L.push(`| ${t.n} | ${t.reply.topicId ?? "general"} | ${t.target ?? "n/a"} | ${t.grade ?? "n/a"} | ${t.words ?? "n/a"}${t.maxWords ? ` / ${t.maxWords}` : ""} | ${t.signals.map(s => SIGNAL_LABEL[s]).join("; ") || "none"} | ${fmt(t.mem.levelShift)} | ${t.reply.model ?? "templates"} |`));
  L.push("", "## Quality checks", "", `| Check | ${d.turns.map(t => `Reply ${t.n}`).join(" | ")} |`, `|---|${d.turns.map(() => "---").join("|")}|`);
  const rows = d.turns.map(t => checks(t)); rows[0]?.forEach((c, i) => L.push(`| ${c.label} | ${rows.map(r => r[i].state === "na" ? "n/a" : r[i].state).join(" | ")} |`));
  L.push("", "## What changed and why", "");
  d.turns.forEach(t => { L.push(`**${t.n}. ${t.question || "(no question)"}**`, ...t.reply.adaptations.map(a => `- ${adaptLabel(a)}`), ""); });
  if (d.safeguards.length) { L.push("## Rules that fired", "", ...d.safeguards.map(s => `- Reply ${s.turn}, ${s.name}: ${s.result}`), ""); }
  const refs = new Map<string, { title: string; publisher: string; url: string; replies: number[] }>();
  d.turns.forEach(t => (t.reply.references ?? []).forEach(ref => {
    const entry = refs.get(ref.id) ?? { ...ref, replies: [] };
    entry.replies.push(t.n); refs.set(ref.id, entry);
  }));
  L.push("## Sources", "");
  if (refs.size) for (const ref of refs.values()) L.push(`- Replies ${ref.replies.join(", ")}: [${ref.title}](${ref.url}) — ${ref.publisher}`);
  else L.push("- No mapped source links were recorded for these answers.");
  L.push("");
  L.push("## Method and limits", "", "- Reading grade is the Flesch–Kincaid formula (English only); coverage is a keyword heuristic. Neither is a clinical measure.", "- Memory updates come from keyword rules, not a validated psychological model.",
    "- Understanding was not assessed. This is general education, not advice about anyone's own care.", d.offlineTurns ? `- ${d.offlineTurns} ${d.offlineTurns === 1 ? "answer was" : "answers were"} written by the built-in template engine, not the AI model.` : "");
  return L.join("\n");
}


// ------------------------------------------------------------------ same question, other readers
export const BANDS = ["6-8", "9-11", "12-14", "15-17"] as const;
export interface Reader { age: string; target: number | null; grade: number; words: number; actual: boolean; }
export interface Compare { readers: Reader[]; noMemory: { grade: number; words: number; level: string } | null; }
/** What the built-in engine would have written for the same question at each age band, and without chat memory. A comparison aid, not a record of what was shown. */
function compare(q: string, last: string | null, profile: Profile, actualLevel: string | undefined, hadMemory: boolean): Compare | null {
  if (!q.trim()) return null;
  try {
    const readers: Reader[] = BANDS.map(age => { const r = respond(q, { ...profile, age }, last, DEFAULT_MEMORY); const m = metrics(r.text); return { age, target: r.plan?.targetGrade ?? null, grade: m.grade, words: m.words, actual: age === actualLevel }; });
    let noMemory: Compare["noMemory"] = null;
    if (hadMemory) { const r = respond(q, profile, last, DEFAULT_MEMORY); const m = metrics(r.text); noMemory = { grade: m.grade, words: m.words, level: r.plan?.level ?? profile.age }; }
    return { readers, noMemory };
  } catch { return null; }
}

// ------------------------------------------------------------------ sentence-level readability
export interface Sent { text: string; grade: number; words: number; level: 0 | 1 | 2; }
/** Splits an answer into paragraphs of sentences and grades each one against the target: 0 near or below, 1 a little hard, 2 hard. */
export function heat(text: string, target: number | null): Sent[][] {
  const lines = text.replace(/\r/g, "").split("\n").map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").replace(/\*\*|__|`/g, "").replace(/(^|\s)[*_]([^*_\n]+)[*_]/g, "$1$2").trim()).filter(Boolean);
  return lines.map(line => (line.match(/[^.!?]+(?:[.!?]+["”’')\]]*)?\s*/g) ?? [line]).map(x => x.trim()).filter(Boolean).map(x => {
    const m = metrics(x); const level = target == null ? 0 : m.grade <= target + 1 ? 0 : m.grade <= target + 3 ? 1 : 2;
    return { text: x, grade: m.grade, words: m.words, level: level as 0 | 1 | 2 };
  }));
}

// ------------------------------------------------------------------ quality checks
export type CheckState = "yes" | "no" | "na" | "note";
export interface Check { id: string; label: string; state: CheckState; detail: string; }
export function checks(t: Turn): Check[] {
  const trace = t.reply.trace ?? []; const step = (n: string) => trace.find(s => s.name === n);
  const guard = step("OUTPUT_GUARD"); const val = step("VALIDATE"); const fired = trace.filter(s => s.status === "triggered" && s.name !== "OUTPUT_GUARD" && s.name !== "VALIDATE");
  return [
    { id: "level", label: "Reading level within 2 grades of target", state: t.within == null ? "na" : t.within ? "yes" : "no", detail: t.gap == null ? "Not measured (non-English or no target)" : `Grade ${t.grade} against target ${t.target}` },
    { id: "length", label: "Length within 10% of the word cap", state: t.words == null || t.maxWords == null ? "na" : t.words <= t.maxWords * 1.1 ? "yes" : "no", detail: t.words == null || t.maxWords == null ? "Not measured" : `${t.words} words, cap ${t.maxWords}` },
    { id: "grounded", label: "Grounded in source-linked content", state: t.reply.source ? "yes" : "na", detail: t.reply.source ? `Coverage ${Math.round((t.reply.coverage ?? 0) * 100)}% of key concepts (heuristic)` : "No matching topic; no source-based medical answer was generated" },
    { id: "safety", label: "No safety rule needed to fire", state: fired.length ? "note" : "yes", detail: fired.length ? `Fired: ${fired.map(s => s.name.replaceAll("_", " ").toLowerCase()).join(", ")}` : "Advice and distress checks passed" },
    { id: "guard", label: "Model output passed the guard", state: !guard ? "na" : guard.status === "triggered" ? "note" : "yes", detail: !guard ? "No model output to check" : guard.status === "triggered" ? "The output guard replaced the draft" : "No dosing or prognosis language" },
    { id: "valid", label: "Passed the reading-level validator", state: !val ? "na" : val.status === "triggered" ? "no" : "yes", detail: val ? val.result : "No validation step recorded" },
    { id: "model", label: "Written by the AI model", state: t.offline ? "no" : "yes", detail: t.offline ? "Built-in template engine (model unavailable)" : String(t.reply.model) },
  ];
}

// ------------------------------------------------------------------ findings
export interface Insight { tone: "good" | "note" | "warn"; text: string; }
export function insights(d: ReportData): Insight[] {
  const out: Insight[] = []; const T = d.turns; if (!T.length) return out;
  const graded = T.filter(t => t.gap != null);
  if (graded.length) {
    const worst = graded.reduce((a, b) => (b.gap! > a.gap! ? b : a));
    out.push(d.within === d.graded ? { tone: "good", text: `Every measured answer landed inside the two-grade band. The widest gap was ${worst.gap!.toFixed(1)} grades on reply ${worst.n}.` }
      : { tone: "warn", text: `${d.graded - d.within} of ${d.graded} answers missed the target band. The widest miss was reply ${worst.n}: grade ${worst.grade} against a target of ${worst.target}.` });
  }
  const i = T.findIndex((t, k) => k > 0 && t.signals.length > 0 && t.grade != null && T[k - 1].grade != null);
  if (i > 0) { const a = T[i - 1], b = T[i]; const dg = +(b.grade! - a.grade!).toFixed(1);
    out.push({ tone: "note", text: `After the reader ${b.signals.map(s => SIGNAL_LABEL[s].toLowerCase()).join(" and ")}, the next answer moved from grade ${a.grade} to ${b.grade} (${dg > 0 ? "+" : dg < 0 ? "−" : ""}${Math.abs(dg)}), and the level shift went from ${fmt(a.mem.levelShift)} to ${fmt(b.mem.levelShift)}.` }); }
  const mem = T.find(t => t.compare?.noMemory && t.grade != null);
  if (mem) { const nm = mem.compare!.noMemory!; out.push({ tone: "note", text: `Memory changed reply ${mem.n}. The built-in engine would have written it at grade ${nm.grade} (${nm.level}) without memory, against ${mem.grade} with it.` }); }
  if (d.offlineTurns) out.push({ tone: "warn", text: `${d.offlineTurns} of ${T.length} answers came from the template engine, so they say little about the AI model.` });
  const safe = d.safeguards.filter(x => x.name !== "VALIDATE" && x.name !== "OUTPUT_GUARD"); const val = d.safeguards.filter(x => x.name === "VALIDATE"); const grd = d.safeguards.filter(x => x.name === "OUTPUT_GUARD");
  if (safe.length) out.push({ tone: "note", text: `${safe.length} safety ${safe.length === 1 ? "rule" : "rules"} fired: ${join(uniq(safe.map(s => s.name.replaceAll("_", " ").toLowerCase())))}.` });
  if (val.length) out.push({ tone: "warn", text: `The reading-level validator flagged ${val.length} ${val.length === 1 ? "answer" : "answers"} as off target${d.regenerated ? `, and ${d.regenerated} ${d.regenerated === 1 ? "was" : "were"} regenerated once` : ""}.` });
  if (grd.length) out.push({ tone: "note", text: `The output guard replaced ${grd.length} model ${grd.length === 1 ? "draft" : "drafts"} that contained dosing or prognosis language.` });
  if (T.length < 5) out.push({ tone: "note", text: `This is ${T.length === 1 ? "one answer" : `${T.length} answers`}. That describes a conversation, not how well the method works overall. Use the evaluation harness for that.` });
  return out;
}

// ------------------------------------------------------------------ across every saved conversation
export interface AllData {
  n: number; graded: number; within: number; meanGap: number | null; offline: number; first: string | null; last: string | null;
  byAge: { age: string; n: number; gap: number; within: number }[]; adapt: [string, number][]; signals: [string, number][]; modes: [string, number][]; models: [string, number][];
  rolling: { i: number; rate: number }[]; safety: number; feedback: Record<string, number>;
}
const tally = (xs: string[]) => Object.entries(xs.reduce<Record<string, number>>((a, k) => ((a[k] = (a[k] ?? 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
export function aggregateLog(log: LogEvent[]): AllData {
  const sorted = [...log].sort((a, b) => a.ts.localeCompare(b.ts)); const g = sorted.filter(e => e.grade != null && e.targetGrade != null && (e.lang ?? "en") === "en");
  const gap = (e: LogEvent) => Math.abs(e.grade! - e.targetGrade!); const win = 5;
  const feedback: Record<string, number> = {}; sorted.forEach(e => { if (e.feedback) feedback[e.feedback] = (feedback[e.feedback] ?? 0) + 1; });
  return { n: sorted.length, graded: g.length, within: g.filter(e => gap(e) <= 2).length, meanGap: r1(mean(g.map(gap))), offline: sorted.filter(e => e.model === "onconnect-templates").length, first: sorted[0]?.ts ?? null, last: sorted.at(-1)?.ts ?? null,
    byAge: BANDS.map(age => { const x = g.filter(e => e.age === age); return { age, n: x.length, gap: r1(mean(x.map(gap))) ?? 0, within: x.filter(e => gap(e) <= 2).length }; }).filter(r => r.n > 0),
    adapt: tally(sorted.flatMap(e => e.adaptations ?? [])), signals: tally(sorted.flatMap(e => e.signals ?? [])), modes: tally(sorted.map(e => e.mode ?? "adaptive")), models: tally(sorted.map(e => e.model || "unknown")),
    rolling: g.map((_, i) => { const w = g.slice(Math.max(0, i - win + 1), i + 1); return { i: i + 1, rate: w.filter(e => gap(e) <= 2).length / w.length }; }),
    safety: sorted.filter(e => e.safety).length, feedback };
}
