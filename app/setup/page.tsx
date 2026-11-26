"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMemory, useProfile } from "@/lib/store";
import { DEFAULT_MEMORY } from "@/lib/memory";
import { TOPICS, PROFILES, type Level } from "@/lib/content";
import { LEARNING_PREFERENCES, PROFILE_CONCERNS, type Profile } from "@/lib/engine";
import { LANGS } from "@/lib/langs";

const FORMATS: [Profile["format"][number], string][] = [["steps", "Step by step"], ["examples", "Give me examples"], ["define", "Explain medical words"], ["check", "Ask me if I understand"]];

export default function Setup() {
  const [saved, setSaved] = useProfile(); const [memory, setMemory] = useMemory();
  const [p, setP] = useState<Profile>(saved);
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  if (!loaded && saved.updatedAt) { setP(saved); setLoaded(true); }
  const router = useRouter();
  const toggle = <T,>(arr: T[], v: T) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
  const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) =>
    <button type="button" className={"chip" + (on ? " on" : "")} aria-pressed={on} onClick={onClick}>{children}</button>;
  const steps = 5;
  return (<><div className="card">
    <div className="progress"><i style={{ width: `${((step + 1) / steps) * 100}%` }} /></div>
    <p className="muted">Step {step + 1} of {steps} · Everything is optional and you can change it any time.</p>
    {step === 0 && <><h1>Who is using Onconnect?</h1>
      <div className="chips">{([["child", "I'm the patient"], ["caregiver", "I'm a parent or caregiver"], ["together", "We're using it together"]] as const).map(([v, l]) =>
        <Chip key={v} on={p.role === v} onClick={() => setP({ ...p, role: v })}>{l}</Chip>)}</div>
      <label>Language for answers</label>
      <div className="chips">{LANGS.map(l => <Chip key={l.code} on={(p.lang ?? "en") === l.code} onClick={() => setP({ ...p, lang: l.code })}>{l.native}</Chip>)}</div>
      <p className="muted">Non-English answers are written by the AI model and have not been checked by a medical translator.</p>
      <label>Age range</label>
      <div className="chips">{(Object.keys(PROFILES) as Level[]).map(a => <Chip key={a} on={p.age === a} onClick={() => setP({ ...p, age: a })}>{a}</Chip>)}</div></>}
    {step === 1 && <><h1>What would you like help understanding?</h1>
      <div className="chips">{TOPICS.map(t => <Chip key={t.id} on={p.topics.includes(t.id)} onClick={() => setP({ ...p, topics: toggle(p.topics, t.id) })}>{t.title}</Chip>)}</div>
      <label>Anything you're particularly concerned about? (optional)</label>
      <div className="chips">{PROFILE_CONCERNS.map(c => <Chip key={c} on={p.concerns.includes(c)} onClick={() => setP({ ...p, concerns: toggle(p.concerns, c) })}>{c}</Chip>)}</div>
      <p className="muted">You never have to share a diagnosis. What you enter here is not verified by a healthcare professional.</p></>}
    {step === 2 && <><h1>How should Onconnect explain things?</h1>
      <div className="chips">{(["short", "balanced", "detailed"] as const).map(d => <Chip key={d} on={p.detail === d} onClick={() => setP({ ...p, detail: d })}>{d === "short" ? "Short" : d === "balanced" ? "Balanced" : "Detailed"}</Chip>)}</div>
      <label>Also…</label>
      <div className="chips">{FORMATS.map(([v, l]) => <Chip key={v} on={p.format.includes(v)} onClick={() => setP({ ...p, format: toggle(p.format, v) })}>{l}</Chip>)}</div>
      <label>Optional learning and access preferences</label>
      <p className="muted">Choose communication features that work for you. These are preferences, not diagnoses, and Onconnect will not try to infer a condition.</p>
      <div className="chips">{LEARNING_PREFERENCES.map(x => <Chip key={x.id} on={(p.learningPreferences ?? []).includes(x.id)} onClick={() => setP({ ...p, learningPreferences: toggle(p.learningPreferences ?? [], x.id) })}>
        <span><b>{x.label}</b><br /><span className="muted">{x.description}</span></span>
      </Chip>)}</div></>}
    {step === 3 && <><h1>Tell Onconnect anything</h1>
      <p className="muted">Write as much or as little as you want: what you're going through, what you're worried about, what you've been told, how you like things explained, words you find confusing. This is optional, you can edit it later, and it is not a medical record.</p>
      <textarea className="big" value={p.notes ?? ""} maxLength={4000} onChange={e => setP({ ...p, notes: e.target.value })} placeholder="In your own words…" aria-label="Notes for Onconnect" />
      <div className="muted" style={{ textAlign: "right" }}>{(p.notes ?? "").length} / 4000</div>
      <p className="muted">Your notes are sent to the AI model with your questions so answers can be more relevant. They are stored only in this browser and are never treated as verified information.</p></>}
    {step === 4 && <><h1>Here is what Onconnect knows about how you want to learn</h1>
      <ul><li>Role: {p.role}</li><li>Age range: {p.age} ({PROFILES[p.age]})</li><li>Language: {(LANGS.find(l => l.code === (p.lang ?? "en")) ?? LANGS[0]).native}</li><li>Detail: {p.detail}</li>
        <li>Preferences: {p.format.join(", ") || "none"}</li><li>Topics: {p.topics.map(id => TOPICS.find(t => t.id === id)?.title).join(", ") || "none selected"}</li>
        <li>Learning/access preferences: {(p.learningPreferences ?? []).map(id => LEARNING_PREFERENCES.find(x => x.id === id)?.label).filter(Boolean).join(", ") || "none selected"}</li>
        <li>Concerns: {p.concerns.join("; ") || "none shared"}</li><li>Your notes: {(p.notes ?? "").trim() ? `${(p.notes ?? "").length} characters (shared with the AI model as unverified context)` : "none"}</li></ul>
      <p className="muted">Entered by you · not verified by a healthcare professional.{saved.updatedAt && ` Last updated ${new Date(saved.updatedAt).toLocaleString()}.`}</p>
      {p.topics.length > 0 && <><h2>Your learning plan</h2><ol>{p.topics.map(id => <li key={id}>Understand: {TOPICS.find(t => t.id === id)?.title} <span className="muted">— recommended because you selected it.</span></li>)}</ol></>}</>}
    <div className="row" style={{ marginTop: 24 }}>
      {step > 0 && <button className="btn alt" onClick={() => setStep(step - 1)}>Back</button>}
      {step < steps - 1 ? <button className="btn" onClick={() => setStep(step + 1)}>Next</button>
        : <button className="btn" onClick={() => { setSaved({ ...p, updatedAt: new Date().toISOString() }); router.push("/chat"); }}>Save and start</button>}
      {step < steps - 1 && <button className="btn alt" onClick={() => setStep(steps - 1)}>Skip</button>}
    </div></div>
    <div className="card"><div className="eyebrow">Chat memory</div><h2>What Onconnect has learned from your chats</h2>
      <p className="muted">When you say things like “simpler”, “I don&apos;t understand”, “shorter” or “more detail”, Onconnect adjusts how it explains. You can see and reset it here.</p>
      <div className="kpi"><div><b>{memory.levelShift}</b><span>Level shift</span></div><div><b>{memory.lengthBias}</b><span>Length bias</span></div><div><b>{memory.scaffold}</b><span>Scaffolding</span></div><div><b>{memory.turns}</b><span>Turns learned from</span></div></div>
      {memory.events.length > 0 && <table><tbody>{[...memory.events].reverse().slice(0, 6).map(e => <tr key={e.ts}><td className="muted">{new Date(e.ts).toLocaleTimeString()}</td><td>{e.signals.map(x => <span key={x} className="tagl">{x}</span>)}</td><td>{e.note}</td></tr>)}</tbody></table>}
      <div className="row"><button className="btn alt" onClick={() => setMemory(DEFAULT_MEMORY)}>Reset memory</button></div></div></>);
}
