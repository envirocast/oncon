import { NextResponse } from "next/server";
import { run, type RunInput } from "@/lib/pipeline";
import { clientIp, limited } from "@/lib/ratelimit";
import { matchTopic } from "@/lib/engine";
import { TOPICS } from "@/lib/content";
import { loadApprovedContent } from "@/lib/supabase/content";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (limited(clientIp(req))) return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  let b: RunInput & { stream?: boolean };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof b?.question !== "string" || !b.question.trim()) return NextResponse.json({ error: "Missing question" }, { status: 400 });
  const topicId = matchTopic(b.question)?.topic.id
    ?? (TOPICS.some(topic => topic.id === b.lastTopic) && typeof b.lastTopic === "string" ? b.lastTopic : null);
  const content = topicId ? await loadApprovedContent(topicId) : { content: null, warning: null };

  if (!b.stream) return NextResponse.json(await run(b, undefined, req.signal, content.content ?? undefined, content.warning ?? undefined));

  // NDJSON stream: {t:"delta"|"replace"|"status"} ... then {t:"final", reply}
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (o: unknown) => { try { ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n")); } catch { /* client went away */ } };
      try { const reply = await run(b, send, req.signal, content.content ?? undefined, content.warning ?? undefined); send({ t: "final", reply }); }
      catch (e) { send({ t: "error", message: e instanceof Error ? e.message : "failed" }); }
      try { ctrl.close(); } catch { /* already closed */ }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
