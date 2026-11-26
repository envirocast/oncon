// Picks the model provider. LLM_PROVIDER=gemini|openrouter forces one; otherwise OpenRouter is used when its key is set, else Gemini.
import { generate as gGen, generateStream as gStream, MODEL as G_MODEL, type GenResult, type Turn } from "./gemini";
import { orGenerate, orStream, OR_MODEL } from "./openrouter";
export type { Turn, GenResult };
export interface LLM { name: "gemini" | "openrouter"; key: string; model: string; }

export function pickLLM(): LLM | null {
  // Vercel variables are server-only unless NEXT_PUBLIC_* is used. Read provider keys only
  // on the server and trim them so accidental whitespace does not invalidate credentials.
  const g = (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY)?.trim();
  const o = (process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY)?.trim();
  const want = process.env.LLM_PROVIDER?.toLowerCase();
  const useOr = want === "openrouter" ? !!o : want === "gemini" ? false : !!o;
  if (useOr && o) return { name: "openrouter", key: o, model: OR_MODEL() };
  if (g) return { name: "gemini", key: g, model: G_MODEL };
  return null;
}
type Opts = { timeout?: number; maxOutputTokens?: number };
export const generate = (llm: LLM, system: string, turns: Turn[], opts: Opts = {}) => llm.name === "openrouter" ? orGenerate(llm.key, system, turns, opts) : gGen(llm.key, system, turns, opts);
export const generateStream = (llm: LLM, system: string, turns: Turn[], onDelta: (d: string) => void, opts: Opts & { signal?: AbortSignal } = {}) => llm.name === "openrouter" ? orStream(llm.key, system, turns, onDelta, opts) : gStream(llm.key, system, turns, onDelta, opts);

/** Cheap liveness probe, cached for a minute per provider+key so it never burns quota. */
const cache = new Map<string, { at: number; value: { ok: boolean; status: string } }>();
export async function health(): Promise<{ ok: boolean; status: string; model: string; provider: string }> {
  const llm = pickLLM(); if (!llm) return { ok: false, status: "no API key configured", model: "", provider: "none" };
  const id = llm.name + ":" + llm.key.slice(-6); const hit = cache.get(id); const who = llm.name === "openrouter" ? "OpenRouter" : "Google";
  if (hit && Date.now() - hit.at < 60000) return { ...hit.value, model: llm.model, provider: llm.name };
  const r = await generate(llm, "Reply with the single word: ok", [{ role: "user", text: "ping" }], { timeout: 8000, maxOutputTokens: 64 });
  const auth = r.error === "HTTP 401" || r.error === "HTTP 403";
  const value = r.text ? { ok: true, status: `online via ${who} (${r.ms}ms)` } : { ok: false, status: auth ? `API key rejected by ${who}` : r.error === "HTTP 402" ? "OpenRouter account has no credits" : `unavailable (${r.error})` };
  cache.set(id, { at: Date.now(), value }); return { ...value, model: llm.model, provider: llm.name };
}
