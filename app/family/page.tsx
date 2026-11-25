"use client";
import { useState } from "react";
import { RESOURCES, SCHOOL, TALK } from "@/lib/more";
import { TOPICS } from "@/lib/content";
import { useMemory, useQs, useViewed } from "@/lib/store";
import { citations } from "@/lib/sources";
import Citations from "@/components/Citations";
export default function Family() {
  const [tab, setTab] = useState("talk"); const [q, setQ] = useState(""); const [cat, setCat] = useState("All"); const [mem] = useMemory(); const [qs] = useQs(); const [viewed] = useViewed();
  const cats = ["All", ...new Set(RESOURCES.map(r => r.cat))]; const list = RESOURCES.filter(r => (cat === "All" || r.cat === cat) && (r.name + r.desc + r.geo).toLowerCase().includes(q.toLowerCase()));
  const conf = Object.entries(mem.confusion).filter(([, n]) => n > 0).map(([id]) => TOPICS.find(t => t.id === id)?.title ?? id);
  const tabs = [["talk", "Talking with your child"], ["school", "School & everyday life"], ["learning", "Your child's learning"], ["dir", "Community directory"]];
  return (<><div className="eyebrow">Family</div><h1>For parents, caregivers and school</h1>
    <div className="tabs" style={{ marginTop: 14 }}>{tabs.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
    {tab === "talk" && <>{TALK.map(x => <div className="card" key={x.t}><h3>{x.t}</h3><p style={{ margin: 0 }}>{x.d}</p></div>)}<Citations items={citations(["nci-communication", "cdc-plain-language"])} /></>}
    {tab === "school" && <>{SCHOOL.map(x => <div className="card" key={x.t}><h3>{x.t}</h3><p style={{ margin: 0 }}>{x.d}</p></div>)}<Citations items={citations(["nci-communication"])} /></>}
    {tab === "learning" && <div className="card"><h2>Learning summary on this device</h2><p className="muted">Nothing is shared with anyone. This view reads what is stored in this browser, so a child and caregiver using the same device can review it together.</p>
      <h3>Topics explored</h3><p>{viewed.map(id => TOPICS.find(t => t.id === id)?.title).join(", ") || "None yet"}</p>
      <h3>Topics the child found confusing</h3><p>{conf.join(", ") || "None noted"}</p>
      <h3>Saved questions for the care team</h3><ul>{qs.map(x => <li key={x.id}>{x.text}</li>)}{!qs.length && <li className="muted">None yet</li>}</ul></div>}
    {tab === "dir" && <><div className="banner">Listings are general descriptions of real organizations. <b>Eligibility, availability and contact details are not verified here.</b> Last verified: not yet. Always confirm on the official site. Onconnect never invents programs.</div>
      <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Search resources…" aria-label="Search resources" />
      <div className="chips" style={{ margin: "12px 0" }}>{cats.map(c => <button key={c} className={"chip" + (cat === c ? " on" : "")} onClick={() => setCat(c)}>{c}</button>)}</div>
      {list.map(r => <div className="card" key={r.name} style={{ padding: 18 }}><h3 style={{ margin: 0 }}>{r.name} <span className="tag">{r.cat}</span></h3><p style={{ margin: "6px 0" }}>{r.desc}</p><div className="muted">{r.org} · {r.geo} · Eligibility: see official site · Last verified: not yet</div><a href={r.url} target="_blank" rel="noopener noreferrer">{r.url.replace("https://", "")}</a></div>)}</>}</>);
}
