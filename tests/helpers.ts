import http from "node:http";
// A tiny fake of the Gemini REST API: supports generateContent and streamGenerateContent (SSE).
export interface Mock { url: string; calls: { path: string; key: string | undefined; system: string; turns: number; turnTexts: string[] }[]; close: () => Promise<void>; setText: (t: string | ((system: string) => string)) => void; setStatus: (n: number) => void; }
export async function startMock(): Promise<Mock> {
  let text: string | ((s: string) => string) = "A biopsy is when doctors take a tiny piece of tissue to study it. **Cells** are looked at closely.\n\nThis is general education, not advice about your own care.";
  let status = 200; const calls: Mock["calls"] = [];
  const server = http.createServer((req, res) => {
    let b = ""; req.on("data", c => b += c); req.on("end", () => {
      const j = b ? JSON.parse(b) : {}; const system = j.systemInstruction?.parts?.[0]?.text ?? "";
      calls.push({ path: req.url ?? "", key: req.headers["x-goog-api-key"] as string | undefined, system, turns: (j.contents ?? []).length, turnTexts: (j.contents ?? []).map((turn: { parts?: { text?: string }[] }) => turn.parts?.map(part => part.text ?? "").join("") ?? "") });
      if (req.headers["x-goog-api-key"] !== "test-key") { res.writeHead(401, { "content-type": "application/json" }); res.end(JSON.stringify({ error: { code: 401 } })); return; }
      if (status !== 200) { res.writeHead(status); res.end("{}"); return; }
      const out = typeof text === "function" ? text(system) : text;
      if ((req.url ?? "").includes("streamGenerateContent")) {
        res.writeHead(200, { "content-type": "text/event-stream" });
        const parts = out.match(/.{1,18}/gs) ?? [out];
        let i = 0; const tick = () => { if (i >= parts.length) { res.end(); return; } res.write(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: parts[i++] }] } }] })}\r\n\r\n`); setTimeout(tick, 2); }; tick();
      } else { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: out }] } }] })); }
    });
  });
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  return { url: `http://127.0.0.1:${port}`, calls, close: () => new Promise(r => server.close(() => r())), setText: t => { text = t; }, setStatus: n => { status = n; } };
}
