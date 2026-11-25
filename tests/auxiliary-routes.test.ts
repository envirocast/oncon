import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as clarify } from "@/app/api/clarify/route";
import { POST as followups } from "@/app/api/followups/route";
import { generate, pickLLM, type LLM } from "@/lib/llm";

vi.mock("@/lib/llm", () => ({ generate: vi.fn(), pickLLM: vi.fn() }));

const model: LLM = { name: "openrouter", key: "test-key", model: "test-model" };
const request = (url: string, value: unknown) => new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(pickLLM).mockReturnValue(model);
  vi.mocked(generate).mockResolvedValue({ text: "Could you explain what happens during a biopsy?", ms: 1 });
});

describe("clarify route", () => {
  it("uses the configured provider and rewrites only the question", async () => {
    const response = await clarify(request("http://localhost/api/clarify", { text: "biopsy question" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: "Could you explain what happens during a biopsy?", model: "test-model" });
    expect(generate).toHaveBeenCalledWith(model, expect.stringContaining("Do not answer it"), [{ role: "user", text: "biopsy question" }], expect.any(Object));
  });
  it("returns a validation error for malformed JSON", async () => {
    const response = await clarify(new Request("http://localhost/api/clarify", { method: "POST", body: "{" }));
    expect(response.status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });
  it("uses a deterministic template when no provider is configured", async () => {
    vi.mocked(pickLLM).mockReturnValue(null);
    const response = await clarify(request("http://localhost/api/clarify", { text: "I don't understand this scan" }));
    expect(await response.json()).toEqual({ text: "Can you explain I don't understand this scan?", model: "template" });
    expect(generate).not.toHaveBeenCalled();
  });
});

describe("follow-ups route", () => {
  it("generates contextual questions only for supported topics", async () => {
    vi.mocked(generate).mockResolvedValue({ text: JSON.stringify(["When will we get results?", "What comfort options are available?", "Who will explain the report?"]), ms: 1 });
    const response = await followups(request("http://localhost/api/followups", {
      question: "What is a biopsy?",
      answer: "A biopsy collects a small tissue sample.",
      topicId: "biopsy",
      profile: { role: "caregiver", age: "12-14", lang: "es" },
    }));
    expect(await response.json()).toEqual({ questions: ["When will we get results?", "What comfort options are available?", "Who will explain the report?"], source: "model" });
    expect(generate).toHaveBeenCalledWith(model, expect.stringContaining("parent or caregiver"), expect.any(Array), expect.any(Object));
  });
  it("does not call a model for an unsupported topic", async () => {
    const response = await followups(request("http://localhost/api/followups", {
      question: "tell me about a medicine",
      answer: "unsupported",
      topicId: "unknown",
    }));
    expect(await response.json()).toEqual({ questions: [], source: "unsupported-topic" });
    expect(generate).not.toHaveBeenCalled();
  });
});
