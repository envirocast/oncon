import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startMock, type Mock } from "./helpers";
import { run } from "@/lib/pipeline";
import { generateStream } from "@/lib/gemini";
import { DEFAULT_PROFILE } from "@/lib/engine";
import { TOPICS } from "@/lib/content";
import { TOPIC_SOURCE_IDS } from "@/lib/sources";
import { parseContentVersion } from "@/lib/approvedContent";

let mock: Mock;
beforeAll(async () => { mock = await startMock(); process.env.GEMINI_BASE = mock.url; process.env.GEMINI_API_KEY = "test-key"; delete process.env.OPENROUTER_API_KEY; delete process.env.LLM_PROVIDER; });
afterAll(async () => { await mock.close(); });
beforeEach(() => { mock.calls.length = 0; mock.setStatus(200); process.env.GEMINI_API_KEY = "test-key"; });
const base = { profile: { ...DEFAULT_PROFILE, age: "9-11" as const }, lastTopic: null };

describe("gemini client", () => {
  it("assembles streamed chunks in order", async () => {
    mock.setText("The quick brown fox jumps over the lazy dog. Twice over."); const got: string[] = [];
    const r = await generateStream("test-key", "sys", [{ role: "user", text: "hi" }], d => got.push(d));
    expect(got.length).toBeGreaterThan(1); expect(got.join("")).toBe("The quick brown fox jumps over the lazy dog. Twice over."); expect(r.text).toBe(got.join(""));
  });
  it("reports a rejected key", async () => { const r = await generateStream("bad", "s", [{ role: "user", text: "x" }], () => {}); expect(r.error).toBe("HTTP 401"); });
});

describe("pipeline with a model", () => {
  it("streams deltas, then returns a full, measured reply with a trace", async () => {
    mock.setText("A biopsy takes a tiny piece of tissue. Doctors study the cells. This is general education, not advice about your own care."); const deltas: string[] = [];
    const r = await run({ ...base, question: "what is a biopsy" }, e => { if (e.t === "delta") deltas.push(e.d); });
    expect(deltas.join("")).toBe(r.text); expect(r.model).toBe("gemini-3-flash-preview"); expect(r.metrics!.words).toBeGreaterThan(5);
    expect(r.trace.map(t => t.name)).toEqual(expect.arrayContaining(["GENERATE", "OUTPUT_GUARD", "VALIDATE", "LOG"]));
  });
  it("sends conversation history and grounds generation in curated source-linked content", async () => {
    await run({ ...base, question: "explain that more simply", lastTopic: "biopsy", history: [{ role: "user", text: "what is a biopsy" }, { role: "bot", text: "A biopsy is a sample." }] });
    const c = mock.calls.at(-1)!; expect(c.turns).toBe(3); expect(c.system).toContain("Curated source-linked topic content"); expect(c.system).toContain("biopsy");
  });
  it("asks for the selected language and skips the English-only grade check", async () => {
    const r = await run({ ...base, profile: { ...base.profile, lang: "es" }, question: "what is an mri" });
    expect(mock.calls.at(-1)!.system).toMatch(/Spanish/); expect(r.adaptations).toContain("TRANSLATED_ES"); expect(r.trace.find(t => t.name === "VALIDATE")!.status).toBe("skipped");
  });
  it("regenerates once when the first answer is far over the word cap, and keeps the closer one", async () => {
    let n = 0; mock.setText(() => (n++ === 0 ? Array(400).fill("Pathologists examine histological specimens.").join(" ") : "A biopsy takes a small sample. Doctors look at it."));
    const r = await run({ ...base, question: "what is a biopsy" }); expect(r.text).toBe("A biopsy takes a small sample. Doctors look at it."); expect(r.trace.find(t => t.name === "GENERATE")!.result).toMatch(/2 attempts/);
  });
  it("appends a care-team redirect if the model drifts into dosing or prognosis", async () => {
    mock.setText("You should take 500 mg twice a day. Your prognosis is good.");
    const r = await run({ ...base, question: "what is a biopsy" }); expect(r.text).toMatch(/care team/i); expect(r.adaptations).toContain("OUTPUT_GUARD_REDIRECT");
  });
  it("includes authoritative references for supported answers", async () => {
    const r = await run({ ...base, question: "what is a biopsy" });
    expect(r.references?.map(s => s.id)).toEqual(["nci-diagnosis", "radiology-biopsy"]);
    expect(mock.calls.at(-1)!.system).toContain("RadiologyInfo.org");
  });
  it("uses only validated clinician-approved versions when available", async () => {
    const topic = TOPICS.find(item => item.id === "biopsy")!;
    const updated = { ...topic, why: { ...topic.why, "9-11": "A clinician-reviewed biopsy explanation for this approved version." } };
    const approved = parseContentVersion({
      id: "approved-version", topic_id: topic.id, version: 3, payload: updated,
      source_ids: TOPIC_SOURCE_IDS[topic.id], status: "approved", created_by: "admin", created_at: new Date().toISOString(),
    });
    expect(approved).not.toBeNull();
    const r = await run({ ...base, question: "what is a biopsy" }, undefined, undefined, approved!);
    expect(mock.calls.at(-1)!.system).toContain("clinician-reviewed biopsy explanation");
    expect(r.source).toContain("Clinician-reviewed content v3");
    expect(r.trace.find(step => step.name === "CONTENT_VERSION")?.result).toContain("approved version 3");
  });
  it("reports when a matched topic falls back to draft content", async () => {
    const warning = "No clinician-approved version is available for this topic; built-in source-linked draft content was used.";
    const r = await run({ ...base, question: "what is a biopsy" }, undefined, undefined, undefined, warning);
    expect(r.notDone).toContain(warning);
    expect(r.trace.find(step => step.name === "CONTENT_VERSION")?.result).toBe(warning);
  });
  it("does not generate unsupported medical answers from model knowledge", async () => {
    const r = await run({ ...base, question: "tell me about a medicine not in the guide" });
    expect(mock.calls.length).toBe(0);
    expect(r.topicId).toBeNull();
    expect(r.references).toBeUndefined();
    expect(r.text).toMatch(/Which one would you like to learn about/);
  });
  it("uses the selected role, accessibility preferences, and concerns as communication context", async () => {
    await run({ ...base, profile: { ...base.profile, role: "caregiver", learningPreferences: ["literal", "predictable", "low_sensory"], concerns: ["I'm worried about pain or discomfort"] }, question: "what is a biopsy" });
    const system = mock.calls.at(-1)!.system;
    expect(system).toMatch(/parent or caregiver/);
    expect(system).toMatch(/Avoid idioms/);
    expect(system).toMatch(/before, during, and after/);
    expect(system).toMatch(/Keep sound, touch, and other sensory descriptions brief/);
    expect(system).toMatch(/pain or discomfort/);
  });
  it("never calls the model for distress messages", async () => {
    const r = await run({ ...base, question: "i want to die" }); expect(r.safety).toBe("SUPPORT_REDIRECT"); expect(mock.calls.length).toBe(0);
  });
  it("baseline mode ignores profile, notes and memory", async () => {
    await run({ ...base, profile: { ...base.profile, notes: "SECRET-NOTE" }, question: "what is a ct scan", mode: "baseline" });
    const c = mock.calls.at(-1)!; expect(c.system).not.toContain("SECRET-NOTE"); expect(c.system).toContain("general audience"); expect(c.system).not.toContain("Flesch");
  });
  it("passes notes to the model as unverified context", async () => {
    await run({ ...base, profile: { ...base.profile, notes: "I like dinosaurs" }, question: "what is a ct scan" }); expect(mock.calls.at(-1)!.system).toMatch(/unverified[\s\S]*I like dinosaurs/);
  });
});

describe("pipeline fallback", () => {
  it("falls back to the template engine when the key is rejected, and says why", async () => {
    process.env.GEMINI_API_KEY = "wrong"; const r = await run({ ...base, question: "what is a biopsy" });
    expect(r.model).toBe("onconnect-templates"); expect(r.text).toMatch(/biopsy/i); expect(r.trace.find(t => t.name === "GENERATE")!.result).toMatch(/HTTP 401/);
  });
  it("falls back when there is no key at all", async () => { delete process.env.GEMINI_API_KEY; const r = await run({ ...base, question: "what is an mri" }); expect(r.model).toBe("onconnect-templates"); });
  it("falls back on a server error", async () => { mock.setStatus(500); const r = await run({ ...base, question: "what is an mri" }); expect(r.model).toBe("onconnect-templates"); });
  it("reports when the offline template cannot honor a sensory-detail preference", async () => {
    delete process.env.GEMINI_API_KEY;
    const r = await run({ ...base, profile: { ...base.profile, learningPreferences: ["low_sensory"] }, question: "what is an mri" });
    expect(r.notDone).toContain("The offline template could not reliably apply your preference to keep sensory descriptions brief.");
    expect(r.adaptations).not.toContain("LOW_SENSORY_DETAIL_PREFERENCE");
  });
});
