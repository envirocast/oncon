import { describe, expect, it } from "vitest";
import { SYNC_KEYS, isList, isSyncKey, mergeLists, planSync, shouldClearLocalForUserSwitch } from "@/lib/sync";
import { answerRow, ratingRow, studyRow } from "@/lib/research";

describe("mergeLists", () => {
  it("unions by id and never drops a record", () => {
    const out = mergeLists([{ id: "a", ts: "2026-01-02" }, { id: "b", ts: "2026-01-01" }], [{ id: "c", ts: "2026-01-03" }, { id: "a", ts: "2026-01-02" }]) as { id: string }[];
    expect(out.map(x => x.id).sort()).toEqual(["a", "b", "c"]);
  });
  it("keeps the newer copy of the same id", () => {
    const out = mergeLists([{ id: "a", ts: "2026-01-01", v: 1 }], [{ id: "a", ts: "2026-02-01", v: 2 }]) as { v: number }[];
    expect(out).toHaveLength(1); expect(out[0].v).toBe(2);
  });
  it("sorts newest first when records have timestamps", () => {
    const out = mergeLists([{ id: "a", ts: "2026-01-01" }], [{ id: "b", ts: "2026-03-01" }]) as { id: string }[];
    expect(out.map(x => x.id)).toEqual(["b", "a"]);
  });
  it("dedupes plain values", () => { expect(mergeLists(["x", "y"], ["y", "z"]).sort()).toEqual(["x", "y", "z"]); });
});

describe("planSync", () => {
  const ago = "2026-01-01T00:00:00Z", later = "2026-02-01T00:00:00Z";
  it("pushes local data the cloud has never seen", () => {
    expect(planSync({ "onc.profile": { age: "9-11" } }, {}, []).find(a => a.key === "onc.profile")?.op).toBe("pushLocal");
  });
  it("pulls cloud data onto an empty device", () => {
    const a = planSync({}, {}, [{ key: "onc.profile", value: { age: "6-8" }, updated_at: later }]).find(x => x.key === "onc.profile");
    expect(a).toEqual({ key: "onc.profile", op: "applyRemote", value: { age: "6-8" } });
  });
  it("does nothing when both sides match", () => {
    expect(planSync({ "onc.profile": { a: 1 } }, {}, [{ key: "onc.profile", value: { a: 1 }, updated_at: later }])).toEqual([]);
  });
  it("merges list keys on both sides instead of overwriting", () => {
    const a = planSync({ "onc.bookmarks": [{ id: "1" }] }, {}, [{ key: "onc.bookmarks", value: [{ id: "2" }], updated_at: later }])[0];
    expect(a.op).toBe("merged"); expect((a as { value: unknown[] }).value).toHaveLength(2);
  });
  it("last write wins for objects: newer cloud copy is applied", () => {
    const a = planSync({ "onc.profile": { age: "9-11" } }, { "onc.profile": ago }, [{ key: "onc.profile", value: { age: "12-14" }, updated_at: later }])[0];
    expect(a.op).toBe("applyRemote");
  });
  it("last write wins for objects: a newer local copy is pushed", () => {
    const a = planSync({ "onc.profile": { age: "9-11" } }, { "onc.profile": later }, [{ key: "onc.profile", value: { age: "12-14" }, updated_at: ago }])[0];
    expect(a.op).toBe("pushLocal");
  });
  it("on a first sync with no history, the local copy wins", () => {
    expect(planSync({ "onc.profile": { age: "9-11" } }, {}, [{ key: "onc.profile", value: { age: "12-14" }, updated_at: later }])[0].op).toBe("pushLocal");
  });
});

describe("sync keys", () => {
  it("clears local account data only when switching between known accounts", () => {
    expect(shouldClearLocalForUserSwitch("user-a", "user-b")).toBe(true);
    expect(shouldClearLocalForUserSwitch(null, "user-a")).toBe(false);
    expect(shouldClearLocalForUserSwitch("user-a", "user-a")).toBe(false);
    expect(shouldClearLocalForUserSwitch("user-a", null)).toBe(false);
  });
  it("never include device-only settings", () => { for (const k of ["onc.theme", "onc.size", "onc.rail", "onc.syncmeta", "onc.share", "onc.eval"]) expect(isSyncKey(k)).toBe(false); });
  it("syncs procedure journey progress as an object, not a list", () => { expect(isSyncKey("onc.procedures")).toBe(true); expect(isList("onc.procedures")).toBe(false); });
  it("knows which keys are lists", () => { expect(isList("onc.convos")).toBe(true); expect(isList("onc.profile")).toBe(false); expect(SYNC_KEYS.length).toBeGreaterThan(10); });
});

describe("research rows", () => {
  it("never carry chat text or profile notes", () => {
    const row = answerRow({ id: "e1", session: "s", ts: "2026-01-01", age: "9-11", detail: "balanced", format: [], topic: "mri", adaptations: ["EXAMPLE_ADDED"], grade: 5.1, targetGrade: 5.5, words: 90, source: "x", coverage: 0.5, model: "m", promptVersion: "v", safety: undefined, clarification: null, feedback: null, lang: "en", mode: "adaptive", signals: [] } as never);
    expect(Object.keys(row)).not.toContain("text"); expect(JSON.stringify(row)).not.toMatch(/notes|question|answer/i);
    expect(row.grade).toBe(5.1); expect(row.adaptations).toEqual(["EXAMPLE_ADDED"]);
  });
  it("clips long free text on clinician comments", () => { expect(ratingRow({ id: "r", topic: "t", decision: "ok", accuracy: 4, ageFit: 4, safety: 5, comment: "x".repeat(900), rater: "dr", ts: "" } as never).comment).toHaveLength(500); });
  it("keeps participant codes and conditions for the study", () => { const r = studyRow({ id: "s", ts: "", pid: "P001", condition: "adapted", topic: "mri", age: "9-11", score: 4, total: 5, selfRated: 4, ms: 1000, grade: 5 } as never); expect(r.pid).toBe("P001"); expect(r.condition).toBe("adapted"); });
});
