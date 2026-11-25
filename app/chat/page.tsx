"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, BookOpen, Bookmark, BookmarkCheck, Check, Copy, CornerDownRight, Download, Info, Magnet, Mic, PanelRight, Printer, RotateCw, Scan, ShieldCheck, Square, Stethoscope, ThumbsDown, ThumbsUp, Volume2, X, type LucideIcon } from "lucide-react";
import { useBookmarks, useLog, useMemory, useProfile, useViewed, type LogEvent, type Msg } from "@/lib/store";
import { WORDS } from "@/lib/more";
import { useChat } from "@/lib/chat";
import type { Reply } from "@/lib/engine";
import { DEFAULT_MEMORY } from "@/lib/memory";
import { TOPICS } from "@/lib/content";
import { LANGS, langOf } from "@/lib/langs";
import { useSmooth } from "@/lib/useSmooth";
import Md from "@/components/Md";
import { shareAnswer } from "@/lib/research";
import Citations from "@/components/Citations";

const SUGGEST: [string, LucideIcon][] = [["What happens during a biopsy?", Stethoscope], ["What is an MRI?", Magnet], ["Can you explain a CT scan?", Scan], ["What does tissue mean?", BookOpen]];
const uid = () => Math.random().toString(36).slice(2, 10);
interface Live { id: string; text: string; status: string; committed: boolean; }
interface Health { ok: boolean; status: string; model: string; }

/** One assistant bubble. While `animate` is on, text is revealed smoothly as it streams in. */
function Bubble({ text, animate, rtl, onTick, onCaughtUp }: { text: string; animate: boolean; rtl: boolean; onTick: () => void; onCaughtUp: () => boolean | void }) {
  const shown = useSmooth(text, animate, onCaughtUp);
  useEffect(onTick, [shown]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="btext" dir={rtl ? "rtl" : "auto"}><Md text={shown} />{animate && <span className="caret" aria-hidden />}</div>;
}

export default function Chat() {
  const [profile, setProfile, pready] = useProfile();
  const { active, activeId, ready, addMsg, patchMsg, removeMsg, newChat } = useChat();
  const msgs = active?.msgs ?? [];
  const [, setLog] = useLog(); const [marks, setMarks] = useBookmarks(); const [memory, setMemory] = useMemory(); const [, setViewed] = useViewed();
  const [pick, setPick] = useState<{ text: string; x: number; y: number } | null>(null);
  const [input, setInput] = useState(""); const [live, setLive] = useState<Live | null>(null); const busy = live !== null;
  const [sel, setSel] = useState<string | null>(null); const [drawer, setDrawer] = useState(false);
  const [listening, setListening] = useState(false); const [speaking, setSpeaking] = useState<string | null>(null); const [copied, setCopied] = useState<string | null>(null);
  const [health, setHealth] = useState<Health | null>(null); const [toast, setToast] = useState<string | null>(null); const [fu, setFu] = useState<{ id: string; qs: string[] } | null>(null);
  const [announce, setAnnounce] = useState(""); const [tab, setTab] = useState<"answer" | "memory" | "trace">("answer"); const [pendingQ, setPendingQ] = useState<string | null>(null); const sentQ = useRef(false);
  const scroller = useRef<HTMLDivElement>(null); const ta = useRef<HTMLTextAreaElement>(null); const abort = useRef<AbortController | null>(null); const stick = useRef(true); const [away, setAway] = useState(false);
  const lang = langOf(profile.lang);

  const toBottom = useCallback(() => { const el = scroller.current; if (el && stick.current) el.scrollTop = el.scrollHeight; }, []);
  useEffect(toBottom, [msgs.length, live?.status, toBottom]);
  const liveConvo = useRef<string | null>(null);   // the conversation the in-flight answer belongs to
  useEffect(() => { setSel(null); setFu(null); if (activeId !== liveConvo.current) { abort.current?.abort(); setLive(null); } }, [activeId]);
  const checkHealth = useCallback(() => { setHealth(null); fetch("/api/health").then(r => r.json()).then(setHealth).catch(() => setHealth({ ok: false, status: "server unreachable", model: "" })); }, []);
  useEffect(checkHealth, [checkHealth]);
  const say = (t: string) => { setToast(t); setTimeout(() => setToast(null), 2600); };

  useEffect(() => { if (!ready || !pready || sentQ.current) return; sentQ.current = true; const q = new URLSearchParams(location.search).get("q"); if (q) { history.replaceState(null, "", "/chat"); newChat(); setPendingQ(q); } }, [ready, pready, newChat]);
  useEffect(() => { if (pendingQ && !active) { const q = pendingQ; setPendingQ(null); send(q); } }); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null; const typing = el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.tagName === "SELECT" || el.isContentEditable);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); ta.current?.focus(); }
      if (e.key === "Escape") { if (abort.current && busy) abort.current.abort(); else setDrawer(false); }
    };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [busy]);

  async function send(q: string, clar: string | null = null, regenOf: Msg | null = null) {
    if (!q.trim() || busy) return;
    const base = regenOf ? msgs.slice(0, msgs.findLastIndex(m => m.role === "user")) : msgs;          // history excludes the turn being (re)answered
    const last = [...base].reverse().find(m => m.reply?.topicId)?.reply?.topicId ?? null;
    const memIn = regenOf ? ([...base].reverse().find(m => m.reply)?.reply?.memory ?? DEFAULT_MEMORY) : memory;   // regenerate must not double-count signals
    const history = base.slice(-8).map(m => ({ role: m.role, text: m.text }));
    const sid = regenOf ? (active?.id ?? uid()) : addMsg({ id: uid(), role: "user", text: q });
    liveConvo.current = sid; setInput(""); if (ta.current) ta.current.style.height = "auto"; stick.current = true; setFu(null);
    const id = uid(); const ac = new AbortController(); abort.current = ac; let text = "";
    setLive({ id, text: "", status: "Thinking", committed: false });
    try {
      const r = await fetch("/api/chat", { method: "POST", signal: ac.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ question: q, profile, lastTopic: last, memory: memIn, history, stream: true }) });
      if (!r.ok || !r.body) throw new Error(r.status === 429 ? "rate" : "http");
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = ""; let final: Reply | null = null;
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true }); let i: number;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.t === "delta") { text += ev.d; const t = text; setLive(l => l && { ...l, text: t, status: "Writing" }); }
          else if (ev.t === "replace") { text = ev.text; const t = text; setLive(l => l && { ...l, text: t }); }
          else if (ev.t === "status") setLive(l => l && { ...l, status: ev.s });
          else if (ev.t === "final") final = ev.reply; else if (ev.t === "error") throw new Error(ev.message);
        }
      }
      if (!final) throw new Error("incomplete");
      const reply: Reply = { ...final, id };
      if (regenOf) removeMsg(regenOf.id);
      setMemory(reply.memory); if (reply.topicId) setViewed(v => [reply.topicId!, ...v.filter(x => x !== reply.topicId)].slice(0, 20));
      addMsg({ id, role: "bot", text: reply.text, reply }); setSel(id); setLive(l => l && { ...l, text: reply.text, committed: true });
      const ev: LogEvent = { id, session: sid, signals: reply.signals, levelShift: reply.memory?.levelShift, targetGrade: reply.plan?.targetGrade ?? null, ts: reply.ts ?? new Date().toISOString(), age: profile.age, detail: profile.detail, format: profile.format, topic: reply.topicId, adaptations: reply.adaptations, source: reply.source,
        coverage: reply.coverage ?? null, grade: reply.metrics?.grade ?? null, words: reply.metrics?.words ?? null, model: reply.model ?? "unknown", promptVersion: reply.promptVersion ?? "", safety: reply.safety, clarification: regenOf ? "REGENERATE" : clar, feedback: null, lang: reply.lang, mode: reply.mode };
      setLog(l => [...l, ev]); void shareAnswer(ev);
    } catch (e) {
      const stopped = e instanceof DOMException && e.name === "AbortError";
      if (stopped && text.trim()) addMsg({ id, role: "bot", text, stopped: true });
      else if (!stopped) addMsg({ id: uid(), role: "bot", text: e instanceof Error && e.message === "rate" ? "You're sending messages very quickly. Please wait a moment and try again." : "Sorry, something went wrong reaching the server. Check your connection and try again.", stopped: true });
      setLive(null);
    }
  }
  const finished = (m: Msg) => { setLive(l => (l?.id === m.id ? null : l)); setAnnounce("Answer ready."); if (!m.reply) return;
    const reply = m.reply; const fallback = reply.topicId ? TOPICS.find(t => t.id === reply.topicId)?.questions.slice(0, 3) ?? [] : []; setFu({ id: m.id, qs: fallback });
    const q = [...msgs].reverse().find(x => x.role === "user")?.text ?? "";
    fetch("/api/followups", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: q, answer: m.text, topicId: reply.topicId, profile }) }).then(r => r.json()).then(j => { if (j.questions?.length) setFu(f => (f?.id === m.id ? { id: m.id, qs: j.questions } : f)); }).catch(() => {}); };

  const stop = () => abort.current?.abort();
  const regen = (m: Msg) => { const u = [...msgs].reverse().find(x => x.role === "user"); if (u) send(u.text, "REGENERATE", m); };
  const fb = (id: string, f: Msg["feedback"]) => { patchMsg(id, { feedback: f }); setLog(l => l.map(e => e.id === id ? { ...e, feedback: f ?? null } : e)); };
  const speak = (m: Msg) => { const s = window.speechSynthesis; if (!s) return say("Read aloud isn't supported in this browser."); if (speaking === m.id) { s.cancel(); setSpeaking(null); return; } s.cancel();
    const u = new SpeechSynthesisUtterance(m.text.replace(/[*_`#]/g, "")); u.lang = lang.speech; u.onend = () => setSpeaking(null); setSpeaking(m.id); s.speak(u); };
  const listen = () => { const SR = (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }); const C = SR.SpeechRecognition || SR.webkitSpeechRecognition; if (!C) return say("Voice input isn't supported in this browser. Try Chrome or Safari.");
    const r = new C(); r.lang = lang.speech; r.onresult = (e: any) => setInput(e.results[0][0].transcript); r.onend = () => setListening(false); r.onerror = () => { setListening(false); say("Couldn't hear that. Check microphone permission."); }; setListening(true); r.start(); };
  const copy = (m: Msg) => { navigator.clipboard?.writeText(m.text); setCopied(m.id); setTimeout(() => setCopied(null), 1200); };
  const save = (m: Msg) => setMarks(b => b.some(x => x.id === m.id) ? b.filter(x => x.id !== m.id) : [...b, { id: m.id, title: TOPICS.find(t => t.id === m.reply?.topicId)?.title ?? "Explanation", text: m.text, ts: new Date().toISOString(), references: m.reply?.references }]);
  const exportMd = () => { const body = msgs.map(m => `**${m.role === "user" ? "You" : "Onconnect"}:** ${m.text}${m.reply?.references?.length ? `\n\nSources:\n${m.reply.references.map(s => `- [${s.title}](${s.url}) — ${s.publisher}`).join("\n")}` : ""}`).join("\n\n"); const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([`# Onconnect conversation\n_${new Date().toLocaleString()} · ages ${profile.age} · ${lang.name}_\n\n${body}\n\n---\nGeneral education only, not advice about your own care. Check each answer's displayed source and review status; built-in draft content may be pending clinician review.\n`], { type: "text/markdown" })); a.download = "onconnect-conversation.md"; a.click(); };

  const onSel = () => { const s = window.getSelection(); const t = s?.toString().trim() ?? ""; if (!t || t.length > 40 || !s?.anchorNode?.parentElement?.closest(".btext")) { setPick(null); return; }
    const r = s.getRangeAt(0).getBoundingClientRect(); setPick({ text: t, x: r.left + r.width / 2, y: r.top }); };
  const def = pick ? WORDS.find(w => w.term.toLowerCase() === pick.text.toLowerCase().replace(/[^a-z ]/gi, "")) : null;
  if (!ready || !pready) return null;
  const rep = msgs.find(m => m.id === sel)?.reply ?? [...msgs].reverse().find(m => m.reply)?.reply;
  const lastBot = [...msgs].reverse().find(m => m.role === "bot");
  const lastTopic = [...msgs].reverse().find(m => m.reply?.topicId)?.reply?.topicId;
  const follow = fu && fu.id === lastBot?.id ? fu.qs : lastTopic ? TOPICS.find(t => t.id === lastTopic)!.questions.slice(0, 3) : [];
  const items = live && !live.committed ? [...msgs, { id: live.id, role: "bot" as const, text: live.text }] : msgs;
  const en = (rep?.lang ?? "en") === "en";

  const composerEl = (<div className="composer"><div className="col760">
    <form className="pill" onSubmit={e => { e.preventDefault(); busy ? stop() : send(input); }}>
      <textarea ref={ta} rows={1} value={input} placeholder="Ask about a procedure, scan, or medical word" aria-label="Your question" maxLength={1000} dir="auto"
        onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(180, e.target.scrollHeight) + "px"; }}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} />
      <button type="button" className={"icon" + (listening ? " on" : "")} onClick={listen} aria-label="Voice input" title="Voice input"><Mic size={19} /></button>
      {busy ? <button type="button" className="send stopbtn" onClick={stop} aria-label="Stop answering"><Square size={13} fill="currentColor" /></button> : <button className="send" disabled={!input.trim()} aria-label="Send"><ArrowUp size={19} /></button>}
    </form>
    <div className="fine">General education only, not advice about your own care. Built-in content may be draft; check each answer&apos;s source and review status.</div>
  </div></div>);

  return (<div className="chatwrap">
    <div className="chathead">
      <Link href="/setup" className="profpill" title="Edit your profile">Onconnect <span>{profile.updatedAt ? `Ages ${profile.age} · ${profile.detail}` : "Set up your profile"}</span></Link>
      <span className="grow" />
      <button className={"statuspill " + (health ? (health.ok ? "ok" : "warn") : "")} onClick={checkHealth} title={health ? `${health.model || "model"}: ${health.status}. Click to re-check.` : "Checking…"}><i className="dot" />{health ? (health.ok ? "Model online" : "Offline mode") : "Checking"}</button>
      <select className="langsel" value={lang.code} onChange={e => setProfile({ ...profile, lang: e.target.value })} aria-label="Answer language">{LANGS.map(l => <option key={l.code} value={l.code}>{l.native}</option>)}</select>
      <button className="hbtn" onClick={exportMd} disabled={!msgs.length} title="Download this conversation" aria-label="Download conversation"><Download size={18} /></button>
      <button className="hbtn" onClick={() => window.print()} disabled={!msgs.length} title="Print or save as PDF for your care team" aria-label="Print"><Printer size={18} /></button>
      <button className={"hbtn" + (drawer ? " on" : "")} onClick={() => setDrawer(d => !d)} title="Research panel" aria-label="Research panel" aria-pressed={drawer}><PanelRight size={18} /></button></div>
    {health && !health.ok && <div className="offline" role="status"><i />Offline mode: answers come from the built-in source-linked content and are less flexible{lang.code !== "en" ? ", English only" : ""}.<button onClick={checkHealth}>Re-check</button></div>}
    {items.length === 0 ? <div className="empty"><div className="col760">
      <div className="bigmark" /><h1>What would you like to understand?</h1>
      <p className="lede">Explanations adapted to you, with a clear record of how.</p>
      {composerEl}
      <div className="sugg">{SUGGEST.map(([t, I]) => <button key={t} onClick={() => send(t)}><I size={16} />{t}</button>)}</div>
      <p className="hint">Press <kbd>/</kbd> to start typing · <kbd>Esc</kbd> stops an answer · select any word to look it up</p></div></div> : <>
    <div className="scroll" ref={scroller} onMouseUp={onSel} onScroll={() => { const el = scroller.current!; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140; setAway(a => { const v = !stick.current; return v === a ? a : v; }); }}><div className="col760">
      {items.map(m => m.role === "user" ? <div key={m.id} className="umsg"><div>{m.text}</div></div> : (
        <div key={m.id} className={"bmsg" + (m.id === sel && drawer ? " sel" : "")}>
          <div className="av" />
          <div className="bbody" onClick={() => m.reply && setSel(m.id)}>
            {m.id === live?.id && !live.text ? <div className="thinking"><span>{live.status}…</span></div>
              : <Bubble text={m.id === live?.id ? live.text : m.text} animate={m.id === live?.id} rtl={langOf(m.reply?.lang).rtl ?? false} onTick={toBottom} onCaughtUp={() => { if (!live?.committed) return false; finished(m as Msg); return true; }} />}
            {m.stopped && <div className="muted" style={{ marginTop: 6, fontSize: "var(--t1)" }}>Stopped</div>}
            {m.reply && m.id !== live?.id && <>
              {m.reply.source && <div className="src"><ShieldCheck size={13} />{m.reply.source}</div>}
              <Citations items={m.reply.references ?? []} />
              <details><summary>Why this explanation?</summary>
                {m.reply.safety?.startsWith("SUPPORT") ? <p>This was a safety message. Nothing was personalized.</p> : <>
                  <b>What Onconnect used</b><ul>{m.reply.used.map(u => <li key={u}>{u}</li>)}</ul>
                  <b>What Onconnect changed</b><ul>{m.reply.changed.map(u => <li key={u}>{u}</li>)}</ul></>}
                <b>What Onconnect did not do</b><ul>{m.reply.notDone.map(u => <li key={u}>{u}</li>)}</ul></details>
              <div className={"acts" + (m.id === lastBot?.id ? " last" : "")}>
                <button title="Copy" aria-label="Copy" onClick={() => copy(m)}>{copied === m.id ? <Check size={16} /> : <Copy size={16} />}</button>
                <button title="Read aloud" aria-label="Read aloud" onClick={() => speak(m)}>{speaking === m.id ? <Square size={14} fill="currentColor" /> : <Volume2 size={16} />}</button>
                <button title="Helpful" aria-label="Helpful" className={m.feedback === "up" ? "on" : ""} onClick={() => fb(m.id, "up")}><ThumbsUp size={16} /></button>
                <button title="Not helpful" aria-label="Not helpful" className={m.feedback === "down" ? "on" : ""} onClick={() => fb(m.id, "down")}><ThumbsDown size={16} /></button>
                <button title="Save" aria-label="Save" className={marks.some(b => b.id === m.id) ? "on" : ""} onClick={() => save(m)}>{marks.some(b => b.id === m.id) ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}</button>
                {m.id === lastBot?.id && <button title="Answer again" aria-label="Regenerate" onClick={() => regen(m)}><RotateCw size={16} /></button>}
                <button title="Research panel" aria-label="Research panel" onClick={() => { setSel(m.id); setDrawer(true); }}><Info size={16} /></button>
                <span className="sep" />
                <button className="pillbtn" onClick={() => { fb(m.id, "simpler"); send("Can you explain that more simply?", "SIMPLER"); }}>Simpler</button>
                <button className="pillbtn" onClick={() => { fb(m.id, "detail"); send("Can you give more detail?", "MORE_DETAIL"); }}>More detail</button>
                <button className="pillbtn" onClick={() => send("Can you make that shorter?", "SHORTER")}>Shorter</button>
              </div></>}
            {m.stopped && !m.reply && m.id !== live?.id && m.id === lastBot?.id && <div className="acts last"><button onClick={() => { const u = [...msgs].reverse().find(x => x.role === "user"); if (u) { removeMsg(m.id); send(u.text); } }}><RotateCw size={14} /> Try again</button></div>}
          </div></div>))}
      {!busy && follow.length > 0 && <div className="follow">{follow.map(f => <button key={f} onClick={() => send(f)}><CornerDownRight size={15} />{f}</button>)}</div>}
    </div></div>
    {away && <button className="tobottom" onClick={() => { stick.current = true; const el = scroller.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }); }} aria-label="Jump to latest"><ArrowDown size={17} /></button>}
    {composerEl}</>}
    <div className="sr" aria-live="polite">{announce}</div>
    {toast && <div className="toast" role="status">{toast}</div>}
    {pick && <div className="defpop" style={{ left: Math.max(8, Math.min(pick.x - 130, innerWidth - 270)), top: Math.max(8, pick.y - 12), transform: "translateY(-100%)" }} onMouseDown={e => e.preventDefault()}>
      {def ? <><b>{def.term}</b><p>{def.simple}</p><div className="muted">{def.example}</div></> : <p style={{ margin: 0 }}>“{pick.text}” isn't in the word list.</p>}
      <div className="row"><button className="btn sm" onClick={() => { send(`What does ${pick.text} mean?`); setPick(null); }}>Ask Onconnect</button><button className="btn alt sm" onClick={() => setPick(null)}>Close</button></div></div>}
    <aside className={"drawer" + (drawer ? " open" : "")} aria-label="Research panel">
      <div className="drawerhead"><div><div className="eyebrow" style={{ marginBottom: 4 }}>Research panel</div><h2 style={{ margin: 0 }}>Live adaptation</h2></div><button className="ib" onClick={() => setDrawer(false)} aria-label="Close"><X size={16} /></button></div>
      <div className="tabs" role="tablist">{([["answer", "This answer"], ["memory", "Memory"], ["trace", "Algorithm"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
      {!rep ? <p className="muted">Ask a question to see how the answer was adapted, measured and grounded.</p> : <>
        {tab === "answer" && <>
          <div className="stat"><div><b>{en ? rep.metrics?.grade ?? "–" : "n/a"}</b><span>Reading grade</span></div><div><b>{en ? rep.metrics?.avgSentence ?? "–" : "n/a"}</b><span>Words / sentence</span></div><div><b>{rep.metrics?.terms ?? 0}</b><span>Med terms</span></div></div>
          {rep.plan && en && <p className="muted" style={{ marginTop: 0 }}>Target grade {rep.plan.targetGrade} · cap {rep.plan.maxWords} words · actual {rep.metrics?.words}.</p>}
          {!en && <p className="muted">Readability uses the English Flesch–Kincaid formula, so it is not computed for {langOf(rep.lang).name}.</p>}
          <div className="muted">Key-concept coverage (heuristic)</div><div className="bar" style={{ margin: "6px 0 14px" }}><i style={{ width: `${(rep.coverage ?? 0) * 100}%` }} /></div>
          <div className="muted" style={{ marginBottom: 4 }}>Adaptation operations</div>
          <div>{rep.adaptations.length ? rep.adaptations.map(a => <span key={a} className="tagl">{a}</span>) : <span className="muted">None applied</span>}</div>
          <table style={{ marginTop: 14 }}><tbody>
            <tr><td className="muted">Profile</td><td>Ages {profile.age}</td></tr><tr><td className="muted">Model</td><td>{rep.model}</td></tr><tr><td className="muted">Prompt</td><td>{rep.promptVersion}</td></tr><tr><td className="muted">Language</td><td>{langOf(rep.lang).name}</td></tr>
            <tr><td className="muted">Grounded in</td><td>{rep.source ?? "No retrieved content"}</td></tr><tr><td className="muted">Safety rule</td><td>{rep.safety ?? "None triggered"}</td></tr></tbody></table></>}
        {tab === "memory" && <>
          <p className="muted" style={{ marginTop: 0 }}>What the app has learned from how you respond. Say “simpler”, “shorter”, “I don&apos;t understand” or “more detail” and watch these move.</p>
          {([["Level shift", memory.levelShift, 2, "Reading level up (+) or down (−) from your age band"], ["Length bias", memory.lengthBias, 2, "Longer (+) or shorter (−) answers"], ["Scaffolding", memory.scaffold, 3, "Extra support: short sentences, examples, steps"]] as const).map(([l, v, mx, d]) => (
            <div key={l} style={{ margin: "12px 0" }}><div style={{ display: "flex", justifyContent: "space-between" }}><b style={{ fontSize: "var(--t2)" }}>{l}</b><span className="muted">{v}</span></div>
              <div className="bar" style={{ position: "relative" }}><i style={{ width: `${((v + (l === "Scaffolding" ? 0 : mx)) / (l === "Scaffolding" ? mx : mx * 2)) * 100}%` }} /></div><div className="muted" style={{ fontSize: "var(--t1)" }}>{d}</div></div>))}
          <table><tbody><tr><td className="muted">Turns learned from</td><td>{memory.turns}</td></tr><tr><td className="muted">Example preference</td><td>{memory.exampleAffinity}</td></tr><tr><td className="muted">Step preference</td><td>{memory.stepAffinity}</td></tr></tbody></table>
          <p className="muted"><Link href="/setup">View or reset memory</Link></p></>}
        {tab === "trace" && <>
          <ol className="trace">{rep.trace?.map(t => <li key={t.n} className={t.status}><b>{t.n}. {t.name}</b><span>{t.result}</span></li>)}</ol>
          {!rep.trace?.length && <p className="muted">This answer was saved before traces existed.</p>}</>}
        <p className="muted" style={{ marginTop: 16 }}>Grade and coverage are automated heuristics, not clinical measures. <Link href="/report">Full report</Link> · <Link href="/method">Method</Link> · <Link href="/log">Audit log</Link></p></>}
    </aside>
  </div>);
}
