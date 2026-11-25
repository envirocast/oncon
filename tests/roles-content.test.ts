import { describe, expect, it } from "vitest";
import { appRoles, hasAppRole } from "@/lib/roles";
import { parseContentVersion } from "@/lib/approvedContent";
import { TOPICS } from "@/lib/content";
import { TOPIC_SOURCE_IDS } from "@/lib/sources";

describe("role claims", () => {
  it("accepts only known role claims from app metadata", () => {
    expect(appRoles({ role: "researcher", roles: ["clinician", "unknown"] })).toEqual(["clinician", "researcher"]);
    expect(hasAppRole({ roles: ["patient", "caregiver"] }, "caregiver")).toBe(true);
    expect(appRoles({ role: "administrator" })).toEqual(["administrator"]);
    expect(appRoles({ user_metadata: { role: "administrator" } })).toEqual([]);
  });
});

describe("versioned educational content validation", () => {
  const topic = TOPICS.find(item => item.id === "mri")!;
  const row = () => ({
    id: "version-1", topic_id: topic.id, version: 1, payload: topic,
    source_ids: TOPIC_SOURCE_IDS[topic.id], status: "approved",
    created_by: "admin-id", created_at: "2026-01-01T00:00:00Z",
  });

  it("parses a supported topic and resolves its mapped citations", () => {
    const parsed = parseContentVersion(row());
    expect(parsed?.topic.id).toBe("mri");
    expect(parsed?.references.map(ref => ref.id)).toEqual(["nci-diagnosis", "radiology-mri"]);
    expect(parsed?.status).toBe("approved");
  });

  it("keeps retained content valid after its author account is erased", () => {
    const parsed = parseContentVersion({ ...row(), created_by: null });
    expect(parsed?.createdBy).toBeNull();
  });

  it.each([
    (value: ReturnType<typeof row>) => { value.topic_id = "unlisted-topic"; },
    (value: ReturnType<typeof row>) => { value.source_ids = ["unknown-source"]; },
    (value: ReturnType<typeof row>) => { value.payload = { ...topic, why: { ...topic.why, "15-17": "" } }; },
  ])("rejects malformed, unsupported, or uncited content", mutate => {
    const value = row(); mutate(value);
    expect(parseContentVersion(value)).toBeNull();
  });
});
