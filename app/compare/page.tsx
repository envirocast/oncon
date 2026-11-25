"use client";
import { useState } from "react";
import { PROFILES, TOPICS, type Level } from "@/lib/content";
import { metrics } from "@/lib/metrics";
import { useProfile } from "@/lib/store";

export default function Compare() {
  const [profile] = useProfile();
  const [id, setId] = useState("biopsy");
  const t = TOPICS.find(x => x.id === id)!;
  const levels = Object.keys(PROFILES) as Level[];
  const rows = levels.map(l => ({ l, text: t.why[l], m: metrics(t.why[l]) }));
  const max = Math.max(...rows.map(r => r.m.grade), 1);
  return (<>
    <div className="eyebrow">Adaptation study</div><h1>One topic, four developmental profiles</h1>
    <p className="muted" style={{ maxWidth: 680 }}>Each version preserves the same essential facts but changes vocabulary, sentence structure and depth. Readability is estimated with the Flesch–Kincaid grade formula.</p>
    <div className="chips" style={{ margin: "16px 0 24px" }}>{TOPICS.map(x => <button key={x.id} className={"chip" + (x.id === id ? " on" : "")} onClick={() => setId(x.id)}>{x.title}</button>)}</div>
    <div className="cols4">{rows.map(r => (<div key={r.l} className="col" style={r.l === profile.age ? { borderColor: "var(--blue)" } : undefined}>
      <div className="eyebrow">Ages {r.l}{r.l === profile.age ? " · your profile" : ""}</div><h3>{PROFILES[r.l]}</h3>
      <p>{r.text}</p>
      <div className="muted">Reading grade {r.m.grade}</div><div className="bar" style={{ margin: "4px 0 10px" }}><i style={{ width: `${(r.m.grade / max) * 100}%` }} /></div>
      <div className="muted">{r.m.words} words · {r.m.avgSentence} words/sentence</div></div>))}</div>
    <div className="card" style={{ marginTop: 20 }}><h2>Preserved core concepts</h2>
      <p className="muted">Concepts the source-linked draft content ties to this topic. Wording changes across ages; facts are intended to remain the same.</p>
      <div>{[t.title, ...t.terms].map(c => <span key={c} className="tagl">{c}</span>)}</div>
      <h3 style={{ marginTop: 18 }}>Teaching strategy by age</h3>
      <table><tbody>{[["6–8", "One concept at a time, concrete analogy, short sentences"], ["9–11", "Cause and effect, correct vocabulary introduced with definitions"], ["12–14", "More detail, optional technical terms, autonomy"], ["15–17", "Direct, technical, honest about uncertainty"]].map(([a, s]) => <tr key={a}><td><b>{a}</b></td><td>{s}</td></tr>)}</tbody></table></div></>);
}
