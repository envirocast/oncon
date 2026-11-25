import { parseContentVersion, type ContentVersion } from "../approvedContent";
import { supabaseServer } from "./server";

export interface ApprovedContentResult {
  content: ContentVersion | null;
  warning: string | null;
}

export async function loadApprovedContent(topicId: string): Promise<ApprovedContentResult> {
  const supabase = await supabaseServer();
  if (!supabase) return { content: null, warning: "No Supabase content library is configured; built-in source-linked draft content was used." };
  const { data, error } = await supabase.from("educational_content_versions")
    .select("id,topic_id,version,payload,source_ids,status,created_by,created_at")
    .eq("topic_id", topicId).eq("status", "approved").order("version", { ascending: false }).limit(1).maybeSingle();
  if (error) {
    const missingMigration = error.code === "42P01" || error.code === "PGRST205";
    return { content: null, warning: missingMigration
      ? "The clinician-approved content library is not installed yet; the draft source-linked content was used."
      : "Clinician-approved content could not be loaded; draft source-linked content was used." };
  }
  if (!data) return { content: null, warning: "No clinician-approved version is available for this topic; built-in source-linked draft content was used." };
  const content = parseContentVersion(data);
  return content
    ? { content, warning: null }
    : { content: null, warning: "The approved content record failed validation; draft source-linked content was used." };
}
