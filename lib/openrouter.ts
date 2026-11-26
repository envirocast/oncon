// Thin OpenRouter client (OpenAI-compatible chat completions). Server-side only. OPENROUTER_BASE can point at a mock in tests.
import type { GenResult, Turn } from "./gemini";
export const OR_MODEL = () => process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
const BASE = () => process.env.OPENROUTER_BASE || "https://openrouter.ai/api/v1";
const headers = (key: string) => ({ authorization: `Bearer ${key}`, "content-type": "application/json", "x-title": "Onconnect", ...(process.env.OPENROUTER_REFERER ? { "http-referer": process.env.OPENROUTER_REFERER } : {}) });
const body = (system: string, turns: Turn[], max: number, stream: boolean) => JSON.stringify({ model: OR_MODEL(), stream, max_tokens: max,
  messages: [{ role: "system", content: system }, ...turns.map(t => ({ role: t.role === "model" ? "assistant" : "user", content: t.text }))] });

export async function orGenerate(key: string, system: string, turns: Turn[], opts: { timeout?: number; maxOutputTokens?: number } = {}): Promise<GenResult> {
  const t0 = Date.now();
  const call = () => fetch(`${BASE()}/chat/completions`, { method: "POST", signal: AbortSignal.timeout(opts.timeout ?? 25000), headers: headers(key), body: body(system, turns, opts.maxOutputTokens ?? 2000, false) });
  try {
    let r = await call();
    if (!r.ok && ![400, 401, 402, 403].includes(r.status)) { await new Promise(res => setTimeout(res, 800)); r = await call(); }
    const j = await r.json().catch(() => null);
    if (!r.ok) return { error: `HTTP ${r.status}`, ms: Date.now() - t0 };
    const text = j?.choices?.[0]?.message?.content ?? "";
    return text ? { text, ms: Date.now() - t0 } : { error: "empty response", ms: Date.now() - t0 };
  } catch (e) { return { error: e instanceof Error ? e.name : "failed", ms: Date.now() - t0 }; }
}

export async function orStream(key: string, system: string, turns: Turn[], onDelta: (d: string) => void, opts: { timeout?: number; maxOutputTokens?: number; signal?: AbortSignal } = {}): Promise<GenResult & { firstTokenMs?: number }> {
  const t0 = Date.now(); let full = ""; let first: number | undefined;
  try {
    const signal = opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(opts.timeout ?? 40000)]) : AbortSignal.timeout(opts.timeout ?? 40000);
    const r = await fetch(`${BASE()}/chat/completions`, { method: "POST", signal, headers: headers(key), body: body(system, turns, opts.maxOutputTokens ?? 2000, true) });
    if (!r.ok || !r.body) return { error: `HTTP ${r.status}`, ms: Date.now() - t0 };
    const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "";
    const take = (line: string) => {
      if (!line.startsWith("data:")) return;                       // also skips ": OPENROUTER PROCESSING" keep-alives
      const payload = line.slice(5).trim(); if (!payload || payload === "[DONE]") return;
      try { const j = JSON.parse(payload); const d = j?.choices?.[0]?.delta?.content ?? ""; if (d) { first ??= Date.now() - t0; full += d; onDelta(d); } } catch { /* ignore */ }
    };
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number; while ((i = buf.search(/\r?\n/)) >= 0) { take(buf.slice(0, i)); buf = buf.slice(i + (buf[i] === "\r" ? 2 : 1)); }
    }
    if (buf) take(buf);
    return full ? { text: full, ms: Date.now() - t0, firstTokenMs: first } : { error: "empty response", ms: Date.now() - t0 };
  } catch (e) { return full ? { text: full, error: e instanceof Error ? e.name : "failed", ms: Date.now() - t0, firstTokenMs: first } : { error: e instanceof Error ? e.name : "failed", ms: Date.now() - t0 }; }
}
