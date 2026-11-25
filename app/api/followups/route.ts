import { NextResponse } from "next/server";
import { generate, pickLLM } from "@/lib/llm";
import { TOPICS } from "@/lib/content";
import { cleanProfile } from "@/lib/pipeline";
import type { Profile } from "@/lib/engine";
import { langOf } from "@/lib/langs";
import { clientIp, limited } from "@/lib/ratelimit";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(req: Request) {
  if (limited(clientIp(req), 60)) return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });

  const body: unknown = await req.json().catch(() => null);
  if (!isRecord(body) || typeof body.question !== "string" || !body.question.trim() || typeof body.answer !== "string" || !body.answer.trim() || typeof body.topicId !== "string") {
    return NextResponse.json({ error: "A question, answer, and supported topic are required." }, { status: 400 });
  }
  const topic = TOPICS.find(item => item.id === body.topicId);
  if (!topic) return NextResponse.json({ questions: [], source: "unsupported-topic" });

  const fallback = topic.questions.slice(0, 3);
  const profile = cleanProfile(isRecord(body.profile) ? body.profile as Partial<Profile> : undefined);
  const lang = langOf(profile.lang);
  const role = profile.role === "caregiver" ? "a parent or caregiver" : profile.role === "together" ? "a child and caregiver reading together" : "a child";
  const llm = pickLLM();
  if (!llm) return NextResponse.json({ questions: fallback, source: "curated" });

  const result = await generate(
    llm,
    `Suggest exactly three short questions (at most 9 words each) that ${role} might ask next about the supported educational topic "${topic.title}". Write them in ${lang.name}, use age-appropriate language for ages ${profile.age}, and return only a JSON array of three strings. Do not answer questions or give medical advice.`,
    [{ role: "user", text: `Question: ${body.question.trim().slice(0, 300)}\nAnswer: ${body.answer.trim().slice(0, 1200)}` }],
    { timeout: 9000, maxOutputTokens: 400 },
  );
  try {
    const parsed: unknown = JSON.parse((result.text ?? "").replace(/^```(json)?|```$/gm, "").trim());
    const questions = Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0 && value.length < 90).slice(0, 3)
      : [];
    if (questions.length === 3) return NextResponse.json({ questions, source: "model" });
  } catch {
    // Use the curated questions when model output is not valid JSON.
  }
  return NextResponse.json({ questions: fallback, source: "curated" });
}
