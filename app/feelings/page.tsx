"use client";
import { useEffect, useState } from "react";
import { Angry, Annoyed, BatteryLow, CloudRain, Frown, Laugh, Meh, Smile, type LucideIcon } from "lucide-react";
import { FEELINGS, JOURNAL, TRUSTED } from "@/lib/more";
import { useFeelings, useLocal } from "@/lib/store";
import Citations from "@/components/Citations";
import { citations } from "@/lib/sources";

const FACE: Record<string, LucideIcon> = { Good: Laugh, Calm: Smile, Okay: Meh, Worried: Annoyed, Sad: Frown, Angry: Angry, Tired: BatteryLow, Overwhelmed: CloudRain };
const Face = ({ label, size = 16 }: { label: string; size?: number }) => { const I = FACE[label] ?? Meh; return <I size={size} aria-hidden />; };
const CONCERNS = ["Procedure", "Pain", "School", "Family", "Not knowing what's next", "Other"];
export default function Feelings() {
  const [tab, setTab] = useState("checkin"); const [list, setList] = useFeelings(); const [em, setEm] = useState<readonly [string, string] | null>(null); const [note, setNote] = useState(""); const [con, setCon] = useState("");
  const [journal, setJournal] = useLocal<{ ts: string; prompt: string; text: string }[]>("onc.journal", []); const [jp, setJp] = useState(JOURNAL[0]); const [jt, setJt] = useState("");
  const [phase, setPhase] = useState(0); const [on, setOn] = useState(false);
  useEffect(() => { if (!on) return; const L = [["Breathe in", 4], ["Hold", 4], ["Breathe out", 6]] as const; let i = 0; setPhase(0); let t: ReturnType<typeof setTimeout>; const step = () => { i = (i + 1) % 3; setPhase(i); t = setTimeout(step, L[i][1] * 1000); }; t = setTimeout(step, L[0][1] * 1000); return () => clearTimeout(t); }, [on]);
  const flagged = /(hurt myself|want to die|kill myself|can'?t do this|don'?t want to live)/i.test(note);
  const L = [["Breathe in", 1.3], ["Hold", 1.3], ["Breathe out", 1]] as const;
  const tabs = [["checkin", "Check-in"], ["history", "History"], ["breathe", "Breathe"], ["ground", "Grounding"], ["journal", "Journal"], ["talk", "Talk to a trusted adult"]];
  return (<><div className="eyebrow">My feelings</div><h1>How are you doing?</h1>
    <p className="muted" style={{ maxWidth: 640 }}>This space is optional. These activities are not therapy and Onconnect does not diagnose feelings. If you feel very upset or unsafe, tell a trusted adult right away.</p>
    <div className="tabs" style={{ marginTop: 14 }}>{tabs.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
    {tab === "checkin" && <div className="card"><h2>Check in</h2><div className="chips">{FEELINGS.map(f => <button key={f[1]} className={"chip" + (em?.[1] === f[1] ? " on" : "")} onClick={() => setEm(f)}><Face label={f[1]} />{f[1]}</button>)}</div>
      <label>What is it about? (optional)</label><div className="chips">{CONCERNS.map(c => <button key={c} className={"chip" + (con === c ? " on" : "")} onClick={() => setCon(con === c ? "" : c)}>{c}</button>)}</div>
      <label>A note (optional)</label><textarea className="big" style={{ minHeight: 80 }} value={note} onChange={e => setNote(e.target.value)} />
      {flagged && <div className="banner" style={{ marginTop: 12 }}>I&apos;m glad you wrote that down. Please tell a trusted adult right now. If you are in danger, tell an adult immediately or call your local emergency number (in the US, call or text 988).<Citations items={citations(["988-lifeline"])} /></div>}
      <div className="row"><button className="btn" disabled={!em} onClick={() => { setList(l => [...l, { id: Math.random().toString(36).slice(2), ts: new Date().toISOString(), emoji: "", label: em![1], note, concern: con }]); setEm(null); setNote(""); setCon(""); setTab("history"); }}>Save check-in</button></div></div>}
    {tab === "history" && <div className="card"><h2>My check-ins</h2>{!list.length && <p className="muted">None yet.</p>}{[...list].reverse().map(f => <div key={f.id} className="step"><b><Face label={f.label} size={20} /></b><span style={{ flex: 1 }}>{f.label}{f.concern && <span className="tagl">{f.concern}</span>}{f.note && <div>{f.note}</div>}<div className="muted">{new Date(f.ts).toLocaleString()}</div></span></div>)}
      <p className="muted">These are your own notes, not clinical assessments.</p></div>}
    {tab === "breathe" && <div className="card" style={{ textAlign: "center" }}><h2>Calm breathing</h2><p className="muted">In for 4, hold for 4, out for 6.</p>
      <div className="breathe" style={{ transform: on ? `scale(${L[phase][1]})` : "scale(1)", transitionDuration: on ? `${[4, 0.5, 6][phase]}s` : ".3s" }}>{on ? L[phase][0] : "Ready"}</div>
      <button className="btn" onClick={() => setOn(o => !o)}>{on ? "Stop" : "Start"}</button></div>}
    {tab === "ground" && <div className="card"><h2>5-4-3-2-1 grounding</h2><p className="muted">Look around and name:</p><ol><li><b>5</b> things you can see</li><li><b>4</b> things you can touch</li><li><b>3</b> things you can hear</li><li><b>2</b> things you can smell</li><li><b>1</b> thing you like about yourself</li></ol><p className="muted">Take your time. Slow breaths help.</p></div>}
    {tab === "journal" && <div className="card"><h2>Journal</h2><div className="chips">{JOURNAL.map(p => <button key={p} className={"chip" + (jp === p ? " on" : "")} onClick={() => setJp(p)}>{p}</button>)}</div>
      <textarea className="big" style={{ marginTop: 12 }} value={jt} onChange={e => setJt(e.target.value)} placeholder={jp} /><div className="row"><button className="btn" disabled={!jt.trim()} onClick={() => { setJournal(j => [...j, { ts: new Date().toISOString(), prompt: jp, text: jt }]); setJt(""); }}>Save entry</button></div>
      {[...journal].reverse().map(j => <div key={j.ts} className="step"><span><b>{j.prompt}</b><div>{j.text}</div><div className="muted">{new Date(j.ts).toLocaleString()}</div></span></div>)}</div>}
    {tab === "talk" && <div className="card"><h2>Words you can use with a trusted adult</h2><ul>{TRUSTED.map(t => <li key={t}>{t}</li>)}</ul></div>}</>);
}
