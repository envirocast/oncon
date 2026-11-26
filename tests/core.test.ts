import { describe, it, expect } from "vitest";
import { metrics, coverage } from "@/lib/metrics";
import { applySignals, detectSignals, DEFAULT_MEMORY } from "@/lib/memory";
import { mean, sd, welch } from "@/lib/stats";
import { respond, matchTopic, DEFAULT_PROFILE } from "@/lib/engine";
import { cleanHistory, cleanProfile } from "@/lib/pipeline";
import { TOPICS } from "@/lib/content";
import { SOURCES, topicCitations } from "@/lib/sources";

describe("metrics", () => {
  it("scores simple text lower than dense text", () => {
    const easy = metrics("The cat sat. The dog ran. We had fun."); const hard = metrics("Pathologists examine histological specimens microscopically to characterize malignant cellular abnormalities.");
    expect(easy.grade).toBeLessThan(hard.grade);
  });
  it("coverage is the share of concepts present", () => { expect(coverage("a biopsy takes tissue", ["biopsy", "tissue", "cell", "needle"])).toBe(0.5); expect(coverage("x", [])).toBe(0); });
});

describe("signal detection", () => {
  it.each([["I don't understand", "CONFUSED"], ["make it simpler", "SIMPLER"], ["can you give more detail", "MORE_DETAIL"], ["that's too long", "SHORTER"], ["got it, thanks", "UNDERSTOOD"], ["show me an example", "WANTS_EXAMPLE"], ["walk me through step by step", "WANTS_STEPS"]])("%s → %s", (q, s) => { expect(detectSignals(q)).toContain(s); });
  it("does not read 'too simple' as a request for simpler", () => { const s = detectSignals("this is too simple, more detail please"); expect(s).toContain("MORE_DETAIL"); expect(s).not.toContain("SIMPLER"); });
  it("neutral questions produce no signals", () => { expect(detectSignals("what is an MRI")).toEqual([]); });
});

describe("memory model", () => {
  it("lowers level and adds scaffolding on confusion, and tracks per-topic confusion", () => {
    const { memory } = applySignals(DEFAULT_MEMORY, ["CONFUSED"], "mri");
    expect(memory.levelShift).toBe(-0.5); expect(memory.scaffold).toBe(1); expect(memory.confusion.mri).toBe(1);
  });
  it("clamps to bounds no matter how many signals", () => {
    let m = DEFAULT_MEMORY; for (let i = 0; i < 20; i++) m = applySignals(m, ["SIMPLER", "CONFUSED"], null).memory;
    expect(m.levelShift).toBe(-2); expect(m.lengthBias).toBe(-2); expect(m.scaffold).toBe(3);
    for (let i = 0; i < 40; i++) m = applySignals(m, ["MORE_DETAIL", "UNDERSTOOD"], null).memory;
    expect(m.levelShift).toBe(2); expect(m.lengthBias).toBe(2); expect(m.scaffold).toBe(0);
  });
  it("is pure: does not mutate its input", () => { const before = JSON.stringify(DEFAULT_MEMORY); applySignals(DEFAULT_MEMORY, ["SIMPLER"], "ct"); expect(JSON.stringify(DEFAULT_MEMORY)).toBe(before); });
  it("keeps at most 100 events", () => { let m = DEFAULT_MEMORY; for (let i = 0; i < 130; i++) m = applySignals(m, ["SHORTER"], null).memory; expect(m.events.length).toBe(100); });
});

describe("stats", () => {
  it("mean and sd", () => { expect(mean([1, 2, 3])).toBe(2); expect(sd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3); });
  it("welch matches a hand-checked case", () => {
    const r = welch([27.5, 21, 19, 23.6, 17, 17.9, 16.9, 20.1, 21.9, 22.6, 23.1, 19.6, 19, 21.7, 21.4], [27.1, 22, 20.8, 23.4, 23.4, 23.5, 25.8, 22, 24.8, 20.2, 21.9, 22.1, 22.9, 20.5, 24.4])!;
    expect(r.t).toBeCloseTo(-2.46, 1); expect(r.p).toBeGreaterThan(0.015); expect(r.p).toBeLessThan(0.025);
  });
  it("returns null for degenerate input", () => { expect(welch([1], [2, 3])).toBeNull(); expect(welch([1, 1, 1], [1, 1, 1])).toBeNull(); });
});

describe("engine", () => {
  it("matches the longest keyword", () => { expect(matchTopic("what is a ct scan")?.topic.id).toBe("ct"); });
  it("matches basic text variants and small topic typos", () => {
    expect(matchTopic("Can you explain an MR I?")?.topic.id).toBe("mri");
    expect(matchTopic("tell me about biopsies")?.topic.id).toBe("biopsy");
    expect(matchTopic("what is a spinal tap")?.topic.id).toBe("lumbar-puncture");
    expect(matchTopic("I need info about chemptherapy")?.topic.id).toBe("chemotherapy");
  });
  it("answers greetings and unknown text directly instead of repeating every topic", () => {
    expect(respond("hello", DEFAULT_PROFILE, null).text).toMatch(/Hi!/);
    expect(respond("explain quantum bananas", DEFAULT_PROFILE, null).text).not.toMatch(/I can explain topics like/);
  });
  it("provides at least one valid source reference for every supported topic", () => {
    const sourceIds = new Set(SOURCES.map(source => source.id));
    for (const topic of TOPICS) {
      const refs = topicCitations(topic.id);
      expect(refs.length, topic.id).toBeGreaterThan(0);
      expect(refs.every(ref => sourceIds.has(ref.id)), topic.id).toBe(true);
    }
  });
  it("uses short chunks and a selected concern in the offline answer", () => {
    const r = respond("what is a biopsy", {
      ...DEFAULT_PROFILE,
      learningPreferences: ["short_chunks"],
      concerns: ["I'm worried about pain or discomfort"],
    }, null);
    expect(r.text).toContain("\n\nA specialist looks");
    expect(r.text).toContain("You can ask your care team what comfort options are planned.");
    expect(r.adaptations).toContain("STATED_CONCERN_CONTEXT");
  });
  it("routes distress language to the fixed safety message and skips personalization", () => {
    const r = respond("i want to die", DEFAULT_PROFILE, null, DEFAULT_MEMORY); expect(r.safety).toBe("SUPPORT_REDIRECT"); expect(r.text).toMatch(/trusted adult/i); expect(r.references?.[0].id).toBe("988-lifeline"); expect(r.plan).toBeUndefined();
  });
  it("flags individual-advice questions", () => { expect(respond("should i stop taking my medicine", DEFAULT_PROFILE, null).safety).toBe("INDIVIDUAL_ADVICE_REDIRECT"); });
  it("shifts the level down after the user says they are confused", () => {
    const a = respond("what is a biopsy", { ...DEFAULT_PROFILE, age: "12-14" }, null, DEFAULT_MEMORY);
    const { memory } = applySignals(DEFAULT_MEMORY, ["SIMPLER"], "biopsy"); const b = respond("what is a biopsy", { ...DEFAULT_PROFILE, age: "12-14" }, null, memory);
    expect(b.plan!.targetGrade).toBeLessThan(a.plan!.targetGrade);
  });
  it("switches to an analogy-first strategy after repeated confusion on one topic", () => {
    let m = DEFAULT_MEMORY; m = applySignals(m, ["CONFUSED"], "mri").memory; m = applySignals(m, ["CONFUSED"], "mri").memory;
    const r = respond("i still don't get mri", DEFAULT_PROFILE, "mri", m); expect(r.plan!.alt).toBe(true); expect(r.adaptations).toContain("ALTERNATE_STRATEGY");
  });
  it("follow-ups carry over the previous topic", () => { expect(respond("why?", DEFAULT_PROFILE, "ct").topicId).toBe("ct"); });
  it("every reply carries a numbered trace", () => { const r = respond("what is mri", DEFAULT_PROFILE, null); expect(r.trace.map(t => t.n)).toEqual(r.trace.map((_, i) => i + 1)); expect(r.trace[0].name).toBe("RECEIVE"); });
});

describe("input sanitising", () => {
  it("coerces junk profiles to safe defaults", () => {
    const p = cleanProfile({ age: "99" as never, role: "admin" as never, notes: "x".repeat(9000), format: ["steps", "hack"] as never, lang: "klingon", learningPreferences: ["literal", "random"] as never });
    expect(p.age).toBe(DEFAULT_PROFILE.age); expect(p.role).toBe("child"); expect(p.notes.length).toBe(4000); expect(p.format).toEqual(["steps"]); expect(p.lang).toBe("en");
    expect(p.learningPreferences).toEqual(["literal"]);
  });
  it("history alternates roles, starts with the user and is capped", () => {
    const h = cleanHistory([{ role: "bot", text: "hi" }, { role: "user", text: "a" }, { role: "user", text: "b" }, { role: "bot", text: "c" }, ...Array.from({ length: 20 }, (_, i) => ({ role: (i % 2 ? "bot" : "user") as "bot" | "user", text: "m" + i }))]);
    expect(h[0].role).toBe("user"); expect(h.every((t, i) => i === 0 || t.role !== h[i - 1].role)).toBe(true); expect(h.length).toBeLessThanOrEqual(8);
  });
});
