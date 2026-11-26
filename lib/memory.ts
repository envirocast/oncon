// Adaptive chat memory: a small, inspectable model of how this user responds to explanations.
// Grounded in: scaffolding / Zone of Proximal Development (Vygotsky), Cognitive Load Theory (Sweller),
// and metacognitive monitoring (explicit "I don't understand" signals are treated as ground truth).
export type Signal = "CONFUSED" | "SIMPLER" | "MORE_DETAIL" | "SHORTER" | "LONGER" | "UNDERSTOOD" | "WANTS_EXAMPLE" | "WANTS_STEPS";
export interface Snap { levelShift: number; lengthBias: number; scaffold: number; }
export interface MemEvent { ts: string; signals: Signal[]; topic: string | null; before: Snap; after: Snap; note: string; }
export interface Memory extends Snap {
  confusion: Record<string, number>; understood: Record<string, number>;
  exampleAffinity: number; stepAffinity: number; turns: number; events: MemEvent[];
}
export const DEFAULT_MEMORY: Memory = { levelShift: 0, lengthBias: 0, scaffold: 0, confusion: {}, understood: {}, exampleAffinity: 0, stepAffinity: 0, turns: 0, events: [] };

const R = {
  MORE: /(too (simple|basic|easy|short|childish)|more (detail|detailed|complex|technical|advanced|context)|tell me more|elaborate|go deeper|in more depth|expand on|go into more detail)/i,
  CONF: /(don'?t (really )?(understand|get|follow)|do not understand|confus|doesn'?t make sense|what do you mean|\bhuh\b|lost me|i'?m lost|makes no sense|unclear|still don'?t|not following|rephrase|say that another way)/i,
  SIMP: /(simpler|simple terms|easier|too (hard|complex|complicated|difficult|technical|long words)|dumb (it )?down|like i'?m (5|five)|eli5|plain (words|english|language)|less jargon|explain (it )?simply)/i,
  SHORT: /(shorter|too long|too much|be brief|briefly|tl;?dr|summari[sz]e|quick(er)? (answer|version)|in a sentence|bottom line|just the gist)/i,
  LONG: /(longer|full explanation|in depth|thorough|too short|more information|more info)/i,
  OK: /(got it|i (get|understand) (it|now)|makes sense|that helps|clear now|thank(s| you)|okay i see|ok i see)/i,
  EX: /(example|analogy|like what|show me|for instance)/i,
  STEP: /(step by step|steps|walk me through|in order|what happens (first|next|then))/i,
};
export function detectSignals(q: string): Signal[] {
  const out = new Set<Signal>();
  let s = q;
  if (R.MORE.test(s)) { out.add("MORE_DETAIL"); s = s.replace(R.MORE, " "); }
  if (R.CONF.test(s)) { out.add("CONFUSED"); s = s.replace(R.CONF, " "); }
  if (R.SIMP.test(s)) out.add("SIMPLER");
  if (R.SHORT.test(s)) out.add("SHORTER");
  if (R.LONG.test(s) && !out.has("MORE_DETAIL")) out.add("LONGER");
  if (R.OK.test(s) && !out.has("CONFUSED")) out.add("UNDERSTOOD");
  if (R.EX.test(s)) out.add("WANTS_EXAMPLE");
  if (R.STEP.test(s)) out.add("WANTS_STEPS");
  return [...out];
}
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const r2 = (v: number) => Math.round(v * 100) / 100;
export const snap = (m: Memory): Snap => ({ levelShift: m.levelShift, lengthBias: m.lengthBias, scaffold: m.scaffold });

export function applySignals(m: Memory, signals: Signal[], topic: string | null): { memory: Memory; changed: string[] } {
  const n: Memory = { ...m, confusion: { ...m.confusion }, understood: { ...m.understood }, events: [...m.events], turns: m.turns + 1 };
  const before = snap(m); const notes: string[] = [];
  for (const s of signals) {
    if (s === "CONFUSED") { n.levelShift -= 0.5; n.scaffold += 1; if (topic) n.confusion[topic] = (n.confusion[topic] ?? 0) + 1; notes.push("confusion → lower level 0.5, add scaffolding"); }
    if (s === "SIMPLER") { n.levelShift -= 1; n.lengthBias -= 0.5; n.scaffold += 1; notes.push("asked simpler → level −1, shorter 0.5, scaffolding"); }
    if (s === "MORE_DETAIL") { n.levelShift += 1; n.lengthBias += 0.5; notes.push("asked more detail → level +1, longer 0.5"); }
    if (s === "SHORTER") { n.lengthBias -= 1; notes.push("asked shorter → length −1"); }
    if (s === "LONGER") { n.lengthBias += 1; notes.push("asked longer → length +1"); }
    if (s === "UNDERSTOOD") { n.scaffold -= 0.5; n.levelShift += 0.25; if (topic) n.understood[topic] = (n.understood[topic] ?? 0) + 1; notes.push("understood → ease scaffolding, nudge challenge +0.25 (ZPD)"); }
    if (s === "WANTS_EXAMPLE") { n.exampleAffinity += 1; notes.push("example preference +1"); }
    if (s === "WANTS_STEPS") { n.stepAffinity += 1; notes.push("step preference +1"); }
  }
  n.levelShift = r2(clamp(n.levelShift, -2, 2)); n.lengthBias = r2(clamp(n.lengthBias, -2, 2)); n.scaffold = r2(clamp(n.scaffold, 0, 3));
  const after = snap(n);
  if (signals.length) n.events = [...n.events, { ts: new Date().toISOString(), signals, topic, before, after, note: notes.join("; ") }].slice(-100);
  const changed = (Object.keys(after) as (keyof Snap)[]).filter(k => after[k] !== before[k]).map(k => `${k} ${before[k]} → ${after[k]}`);
  return { memory: n, changed };
}
