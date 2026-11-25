"use client";
import { useCallback, useEffect, useState } from "react";
import RoleGate from "@/components/RoleGate";
import { useSync } from "@/components/SyncProvider";
import { TOPICS } from "@/lib/content";
import { TOPIC_SOURCE_IDS } from "@/lib/sources";
import { parseContentVersion, type ContentVersion } from "@/lib/approvedContent";
import { supabase } from "@/lib/supabase/client";

export default function Administration() {
  const { user } = useSync();
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [invalidCount, setInvalidCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const sb = supabase();
    if (!sb) return;
    setLoading(true); setError("");
    const { data, error: queryError } = await sb.from("educational_content_versions")
      .select("id,topic_id,version,payload,source_ids,status,created_by,created_at")
      .order("created_at", { ascending: false });
    if (queryError) { setError(queryError.message); setLoading(false); return; }
    const rows = (data ?? []).map(parseContentVersion);
    setVersions(rows.filter((row): row is ContentVersion => row !== null));
    setInvalidCount(rows.filter(row => row === null).length);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const stageCorpus = async () => {
    const sb = supabase();
    if (!sb || !user) return;
    setError(""); setNotice("");
    const nextVersion = new Map<string, number>();
    for (const version of versions) nextVersion.set(version.topicId, Math.max(nextVersion.get(version.topicId) ?? 0, version.version));
    const rows = TOPICS.map(topic => ({
      topic_id: topic.id,
      version: (nextVersion.get(topic.id) ?? 0) + 1,
      payload: topic,
      source_ids: TOPIC_SOURCE_IDS[topic.id] ?? [],
      status: "pending_review",
      created_by: user.id,
    }));
    const { error: insertError } = await sb.from("educational_content_versions").upsert(rows, { onConflict: "topic_id,version", ignoreDuplicates: true });
    if (insertError) { setError(insertError.message); return; }
    setNotice(`${rows.length} content versions were submitted for clinician review. The live chat continues to use its previous approved versions until a clinician approves these drafts.`);
    await refresh();
  };

  return <RoleGate role="administrator">
    <div className="eyebrow">Administrator workspace</div><h1>Content and governance</h1>
    <p className="muted" style={{ maxWidth: 720 }}>Administrators can stage versioned source-linked educational drafts and inspect their review status. Only a separate, role-verified clinician can approve a version; an administrator cannot approve their own submission.</p>
    {notice && <div className="callout good" role="status">{notice}</div>}
    {error && <div className="banner" role="alert">The operation failed: {error}. Confirm the current database migration is applied and this account has the administrator role.</div>}
    {invalidCount > 0 && <div className="banner" role="alert">{invalidCount} database record(s) did not pass content validation and are not displayed.</div>}
    <section className="card"><h2>Versioned content corpus</h2>
      <p>Staging a corpus creates a new draft version for each supported topic. It does not publish or approve content.</p>
      <div className="row"><button className="btn" onClick={() => void stageCorpus()} disabled={loading || !user}>Submit current draft corpus for review</button>
        <button className="btn alt" onClick={() => void refresh()} disabled={loading}>Refresh review statuses</button></div>
      {loading && <p className="muted">Loading protected content status…</p>}
      {!loading && <div className="wrap"><table><thead><tr><th>Topic</th><th>Version</th><th>Status</th><th>Sources</th><th>Submitted</th></tr></thead>
        <tbody>{versions.map(version => <tr key={version.id}><td>{version.topic.title}</td><td>{version.version}</td><td>{version.status.replaceAll("_", " ")}</td><td>{version.references.map(ref => ref.title).join(", ")}</td><td>{new Date(version.createdAt).toLocaleDateString()}</td></tr>)}
          {!versions.length && <tr><td colSpan={5}>No content versions have been staged.</td></tr>}</tbody></table></div>}
    </section>
    <section className="card"><h2>Role assignment and identity verification</h2>
      <p>Roles are held in Supabase <code>app_metadata</code> and cannot be granted by this browser application. A project owner must verify identity and eligibility first, then assign roles from the trusted Supabase dashboard or a controlled administrative procedure. Never expose a service-role key to this app.</p>
      <p>Clinician access should be granted only after credentials are verified. Research access should be limited to approved study personnel. Caregiver links still require patient assent, guardian permission, caregiver consent, and per-summary sharing.</p>
    </section>
  </RoleGate>;
}
