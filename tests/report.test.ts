import { describe, expect, it } from "vitest";
import { buildReport, fmt, reportMarkdown } from "@/lib/report";
import { DEFAULT_PROFILE, respond } from "@/lib/engine";
import { DEFAULT_MEMORY } from "@/lib/memory";
import { metrics } from "@/lib/metrics";
import type { Msg } from "@/lib/store";

function convo(): Msg[] {
  const q1 = respond("what is an mri", DEFAULT_PROFILE, null, DEFAULT_MEMORY); const q2 = respond("I don't get it, explain simpler", DEFAULT_PROFILE, q1.topicId, q1.memory);
  const withM = (r: typeof q1) => ({ ...r, metrics: metrics(r.text), model: "onconnect-templates" });
  return [{ id: "u1", role: "user", text: "what is an mri" }, { id: "b1", role: "bot", text: q1.text, reply: withM(q1) }, { id: "u2", role: "user", text: "I don't get it, explain simpler" }, { id: "b2", role: "bot", text: q2.text, reply: withM(q2), feedback: "simpler" }];
}

describe("buildReport", () => {
  const d = buildReport(convo(), DEFAULT_PROFILE);
  it("pairs each answer with the question that prompted it", () => { expect(d.turns.map(t => t.question)).toEqual(["what is an mri", "I don't get it, explain simpler"]); });
  it("counts only what was measured", () => { expect(d.turns).toHaveLength(2); expect(d.graded).toBe(2); expect(d.within).toBeLessThanOrEqual(d.graded); expect(d.asked).toBe(2); });
  it("records the memory moving after a confusion signal", () => { expect(d.turns[1].signals.length).toBeGreaterThan(0); expect(d.end.levelShift).toBeLessThanOrEqual(d.start.levelShift); });
  it("flags template-engine answers honestly", () => { expect(d.offlineTurns).toBe(2); expect(d.models).toEqual(["onconnect-templates"]); });
  it("writes a headline from measured facts only", () => { expect(d.headline).toMatch(/2 answers on mri/i); expect(d.headline).toMatch(/of 2 landed within two grades/); });
  it("keeps feedback counts", () => { expect(d.feedback).toEqual({ simpler: 1 }); });
  it("skips the grade check for non-English answers", () => {
    const m = convo(); m[1].reply!.lang = "es"; expect(buildReport(m, DEFAULT_PROFILE).turns[0].grade).toBeNull();
  });
  it("is empty and safe with no replies", () => { const e = buildReport([{ id: "u", role: "user", text: "hi" }], DEFAULT_PROFILE); expect(e.turns).toEqual([]); expect(e.meanGap).toBeNull(); });
});
describe("formatting and export", () => {
  it("formats signed numbers", () => { expect(fmt(2)).toBe("+2"); expect(fmt(-1)).toBe("−1"); expect(fmt(0)).toBe("0"); });
  it("exports a markdown table, source links, and limits", () => { const md = reportMarkdown(buildReport(convo(), DEFAULT_PROFILE), "t"); expect(md).toMatch(/\| Reply \| Topic/); expect(md).toContain("[Brain MRI](https://www.radiologyinfo.org/en/info/mri-brain)"); expect(md).toMatch(/not a clinical measure|Neither is a clinical measure/); expect(md).toMatch(/template engine/); });
});

import { aggregateLog, checks, heat, insights } from "@/lib/report";
import type { LogEvent } from "@/lib/store";

describe("sentence heat map", () => {
  it("splits an answer into paragraphs of graded sentences and strips markdown", () => {
    const p = heat("**An MRI** is a big magnet. It takes pictures.\n- Lie still please.\n- The machine is loud and noisy.", 5.5);
    expect(p).toHaveLength(3); expect(p[0]).toHaveLength(2); expect(p[0][0].text).toBe("An MRI is a big magnet."); expect(p[1][0].text).toBe("Lie still please.");
  });
  it("marks very hard sentences relative to the target", () => {
    const hard = "Magnetic resonance imaging utilizes sophisticated radiofrequency electromagnetic instrumentation for comprehensive anatomical visualization.";
    expect(heat(hard, 3)[0][0].level).toBe(2); expect(heat("It is a big box.", 8)[0][0].level).toBe(0);
  });
  it("never crashes on empty text", () => { expect(heat("", 5)).toEqual([]); });
  it("never loses text, including quotes and question marks at the end of a sentence", () => {
    const src = "You can ask the team, “Can I bring music?” The machine is loud! Is it safe? Yes (mostly). It ends here";
    const joined = heat(src, 5).flat().map(x => x.text).join(" ").replace(/\s+/g, " "); expect(joined).toBe(src.replace(/\s+/g, " "));
    expect(heat("Ask “Can I bring music?”", 5)[0].map(x => x.text).join(" ")).toContain("music?”");
  });
});

describe("checks, comparisons and findings", () => {
  const d = buildReport(convo(), DEFAULT_PROFILE);
  it("gives seven checks per answer with a state each", () => { const c = checks(d.turns[0]); expect(c).toHaveLength(7); c.forEach(x => expect(["yes", "no", "na", "note"]).toContain(x.state)); expect(c.find(x => x.id === "model")?.state).toBe("no"); });
  it("compares the same question at all four age bands, marking the one used", () => {
    const cmp = d.turns[0].compare!; expect(cmp.readers.map(r => r.age)).toEqual(["6-8", "9-11", "12-14", "15-17"]); expect(cmp.readers.filter(r => r.actual)).toHaveLength(1);
    const g = cmp.readers.map(r => r.grade); expect(g[0]).toBeLessThan(g[3]);                    // older bands read at a higher grade
  });
  it("shows what memory changed once it has moved", () => { expect(d.turns[1].compare?.noMemory).not.toBeNull(); expect(d.insights.some(i => /Memory changed/.test(i.text)) || d.insights.length > 0).toBe(true); });
  it("states small samples plainly and flags template answers", () => { const t = insights(d).map(i => i.text).join(" "); expect(t).toMatch(/2 answers/); expect(t).toMatch(/template engine/); });
  it("includes findings and checks in the markdown export", () => { const md = reportMarkdown(d, "t"); expect(md).toMatch(/## Key findings/); expect(md).toMatch(/## Quality checks/); });
});

describe("aggregateLog", () => {
  const ev = (o: Partial<LogEvent>): LogEvent => ({ id: Math.random().toString(36), session: "s", ts: "2026-01-01T00:00:00Z", age: "9-11", detail: "balanced", format: [], topic: "mri", adaptations: ["EXAMPLE_ADDED"], source: null, coverage: 0.5, grade: 5.5, words: 100, model: "m", promptVersion: "v", safety: null, clarification: null, feedback: null, targetGrade: 5.5, mode: "adaptive", ...o });
  it("counts, groups by age band and tallies adaptations and signals", () => {
    const a = aggregateLog([ev({ ts: "2026-01-01T00:00:00Z" }), ev({ ts: "2026-01-02T00:00:00Z", grade: 9.5, signals: ["CONFUSED"] }), ev({ ts: "2026-01-03T00:00:00Z", age: "6-8", grade: 3.2, targetGrade: 3 })]);
    expect(a.n).toBe(3); expect(a.graded).toBe(3); expect(a.within).toBe(2); expect(a.byAge.map(r => r.age)).toEqual(["6-8", "9-11"]); expect(a.signals).toEqual([["CONFUSED", 1]]); expect(a.adapt[0]).toEqual(["EXAMPLE_ADDED", 3]);
    expect(a.rolling).toHaveLength(3); expect(a.rolling[2].rate).toBeCloseTo(2 / 3);
  });
  it("ignores non-English answers for grading and handles an empty log", () => { expect(aggregateLog([ev({ lang: "es" })]).graded).toBe(0); const e = aggregateLog([]); expect(e.n).toBe(0); expect(e.meanGap).toBeNull(); });
  it("counts template-engine answers", () => { expect(aggregateLog([ev({ model: "onconnect-templates" }), ev({})]).offline).toBe(1); });
});
