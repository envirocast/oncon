"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Volume2 } from "lucide-react";
import { useParams } from "next/navigation";
import { GLOSSARY, PROFILES, TOPICS, type Level } from "@/lib/content";
import { PROC, QUIZ } from "@/lib/more";
import { useProcedureProgress, useProfile, useViewed, type ProcedureProgress } from "@/lib/store";
import { topicCitations } from "@/lib/sources";
import Citations from "@/components/Citations";

export default function Procedure() {
  const { id } = useParams<{ id: string }>(); const t = TOPICS.find(x => x.id === id);
  const [profile] = useProfile(); const [, setViewed] = useViewed(); const [journey, setJourney, journeyReady] = useProcedureProgress();
  const [mode, setMode] = useState<"guide" | "walk">("guide"); const [depth, setDepth] = useState<"simple" | "standard" | "detailed">("standard");
  const [i, setI] = useState(0); const [ans, setAns] = useState<Record<number, number>>({}); const [simple, setSimple] = useState(false);
  useEffect(() => { if (t) setViewed(v => [t.id, ...v.filter(x => x !== t.id)].slice(0, 20)); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => {
    if (!t || !journeyReady || new URLSearchParams(window.location.search).get("mode") !== "walk") return;
    const saved = journey[t.id];
    const stage = saved?.completedAt ? 0 : saved?.stageIndex ?? 0;
    setMode("walk"); setI(stage); setAns(saved?.quizAnswers ?? {});
    setJourney(current => ({ ...current, [t.id]: { ...current[t.id], stageIndex: stage, startedAt: current[t.id]?.startedAt ?? new Date().toISOString() } }));
    // URL mode is only an entry point; progress remains in local state after navigation.
    // eslint-disable-next-line
  }, [id, journeyReady]);
  if (!t) return <p>Procedure not found. <Link href="/procedures">Back</Link></p>;
  const d = PROC[t.id]; const lvl: Level = depth === "simple" ? "6-8" : depth === "detailed" ? "15-17" : profile.age;
  const quiz = QUIZ[t.id] ?? [];
  const stages = [{ n: "Introduction", b: [t.why[simple ? "6-8" : profile.age]] }, { n: "Meeting the medical team", b: ["You will usually meet the people who will take care of you, like nurses, a doctor and a technologist. They can answer questions before anything starts."] },
    ...(d ? [{ n: "General preparation", b: d.before }] : []), ...t.steps.map((s, k) => ({ n: `During · step ${k + 1}`, b: [s] })), ...(d ? [{ n: "Recovery and follow-up", b: d.after }] : [])];
  const saveProgress = (update: Partial<ProcedureProgress>) => setJourney(current => ({ ...current, [t.id]: { ...current[t.id], ...update } }));
  const startWalk = () => {
    const saved = journey[t.id]; const stage = saved?.completedAt ? 0 : Math.min(saved?.stageIndex ?? 0, stages.length);
    setI(stage); setAns(saved?.quizAnswers ?? {}); setMode("walk");
    setJourney(current => ({ ...current, [t.id]: { ...current[t.id], stageIndex: stage, startedAt: current[t.id]?.startedAt ?? new Date().toISOString() } }));
  };
  const goToStage = (stage: number) => {
    setI(stage); saveProgress({ stageIndex: stage, startedAt: journey[t.id]?.startedAt ?? new Date().toISOString() });
  };
  const finishWalk = () => {
    saveProgress({ stageIndex: stages.length, completedAt: new Date().toISOString(), quizAnswers: ans });
    setMode("guide");
  };
  const speak = (s: string) => { const sy = window.speechSynthesis; if (!sy) return; sy.cancel(); sy.speak(new SpeechSynthesisUtterance(s)); };
  const last = i === stages.length;
  return (<>
    <Link href="/procedures" className="muted">← All procedures</Link>
    <div className="eyebrow" style={{ marginTop: 10 }}>Procedure explorer</div><h1>{t.title}</h1>
    <div className="tabs"><button className={mode === "guide" ? "on" : ""} onClick={() => setMode("guide")}>Guide</button><button className={mode === "walk" ? "on" : ""} onClick={startWalk}>{journey[t.id]?.completedAt ? "Review walkthrough" : journey[t.id]?.startedAt ? "Continue walkthrough" : "Interactive walkthrough"}</button>
      {mode === "guide" && <><span style={{ width: 16 }} />{(["simple", "standard", "detailed"] as const).map(x => <button key={x} className={"chip" + (depth === x ? " on" : "")} onClick={() => setDepth(x)}>{x}</button>)}</>}
      {mode === "walk" && <button className={"chip" + (simple ? " on" : "")} onClick={() => setSimple(s => !s)}>{simple ? "Simple mode" : "Standard mode"}</button>}</div>
    {mode === "guide" ? <>
      <div className="card"><h2>1. What is it?</h2><p>{t.why[lvl]}</p><div className="muted">Wording for ages {lvl} ({PROFILES[lvl]}).</div></div>
      {d && <div className="card"><h2>2. Why might doctors do this?</h2><p>{d.purpose}</p></div>}
      {d && depth !== "simple" && <div className="card"><h2>3. What equipment might be used?</h2><ul>{d.equipment.map(e => <li key={e}>{e}</li>)}</ul></div>}
      {d && <div className="card"><h2>4. Before</h2><ul>{d.before.map(e => <li key={e}>{e}</li>)}</ul></div>}
      <div className="card"><h2>5. What generally happens during</h2><ol>{t.steps.map(s => <li key={s}>{s}</li>)}</ol><p className="muted">{t.example}</p></div>
      {d && <div className="card"><h2>6. What might you experience?</h2><ul>{d.experience.map(e => <li key={e}>{e}</li>)}</ul></div>}
      {d && <div className="card"><h2>7. Afterward</h2><ul>{d.after.map(e => <li key={e}>{e}</li>)}</ul></div>}
      <div className="card"><h2>8. Words to know</h2>{t.terms.map(x => <p key={x}><b>{x}</b>: {GLOSSARY[x]}</p>)}</div>
      <div className="card"><h2>9. Questions you might ask your doctor</h2><ul>{t.questions.map(q => <li key={q}>{q}</li>)}</ul><Link className="btn alt sm" href="/questions">Add to My questions</Link></div>
      <div className="card"><h2>10. Sources and review</h2><p className="muted">This general guide is source-linked but has not been clinician-reviewed. Steps, preparation, equipment, and recovery vary by person and facility; follow the instructions from your care team.</p><Citations items={topicCitations(t.id)} /></div></>
    : <div className="card">
      <p className="muted">Your walkthrough progress is saved on this device. It records activities, not medical readiness or mastery.</p>
      <div className="progress"><i style={{ width: `${(Math.min(i, stages.length) / stages.length) * 100}%` }} /></div>
      {!last ? <><div className="muted">Stage {i + 1} of {stages.length}</div><h2>{stages[i].n}</h2>
        {stages[i].b.map(x => <p key={x}>{x}</p>)}
        <div className="banner">Question to think about or ask: {t.questions[i % t.questions.length]}</div>
        <div className="row"><button className="btn alt" disabled={i === 0} onClick={() => goToStage(i - 1)}>Previous</button><button className="btn" onClick={() => goToStage(i + 1)}>Next</button>
          <button className="btn alt" onClick={() => speak(stages[i].b.join(" "))}><Volume2 size={15} /> Read aloud</button><Link className="btn alt" href="/procedures">Pause and exit</Link></div></>
      : <><h2>{quiz.length ? "Quick check (optional)" : "Walkthrough complete"}</h2>{quiz.map((q, k) => <div key={q.q} style={{ margin: "14px 0" }}><b>{q.q}</b><div className="chips" style={{ marginTop: 6 }}>{q.options.map((o, x) => <button key={o} className={"chip" + (ans[k] === x ? (x === q.answer ? " on" : "") : "")} style={ans[k] === x && x !== q.answer ? { borderColor: "#d9822b" } : undefined} onClick={() => { const answers = { ...ans, [k]: x }; setAns(answers); saveProgress({ quizAnswers: answers }); }}>{o}</button>)}</div>
        {ans[k] !== undefined && <div className="muted" style={{ marginTop: 4 }}>{ans[k] === q.answer ? "Yes, that's right." : "Not quite. Try another one."}</div>}</div>)}
        {quiz.length > 0 && <p className="muted">Answered {Object.keys(ans).length} of {quiz.length}. This optional check is for learning feedback only, not a medical assessment.</p>}
        <div className="row"><button className="btn alt" onClick={() => goToStage(stages.length - 1)}>Back</button><button className="btn" onClick={finishWalk}>Finish</button></div></>}
    </div>}</>);
}
