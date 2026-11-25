"use client";
import { useState } from "react";
import Link from "next/link";
import { ORGANS } from "@/lib/more";
import { TOPICS } from "@/lib/content";
import Body from "@/components/Body";
import Citations from "@/components/Citations";
import { citations } from "@/lib/sources";

export default function Anatomy() {
  const [id, setId] = useState("brain"); const [detail, setDetail] = useState(false);
  const o = ORGANS.find(x => x.id === id)!;
  return (<><div className="eyebrow">Anatomy</div><h1>Explore the body</h1>
    <p>A general illustration of the front of the body. It does not show your own body or your diagnosis. Select an organ, or a label.</p>
    <div className="anat">
      <div className="card figcard"><Body selected={id} onSelect={setId} /><div className="muted" style={{ textAlign: "center" }}>Schematic, not to scale</div></div>
      <div>
        <div className="card"><div className="chips toc">{ORGANS.map(x => <button key={x.id} className={"chip" + (x.id === id ? " on" : "")} onClick={() => setId(x.id)}>{x.name}</button>)}</div></div>
        <div className="card"><h2>{o.name}</h2><p>{detail ? o.detail : o.simple}</p>
          <button className="btn alt sm" onClick={() => setDetail(d => !d)}>{detail ? "Show simple" : "Show detailed"}</button>
          <h3 style={{ marginTop: 20 }}>Related words</h3><div className="chips">{o.terms.map(x => <Link key={x} className="chip" style={{ textDecoration: "none" }} href={`/words?q=${encodeURIComponent(x)}`}>{x}</Link>)}</div>
          <h3 style={{ marginTop: 20 }}>Related procedures</h3><div className="chips">{o.procs.map(p => <Link key={p} className="chip" style={{ textDecoration: "none" }} href={`/procedures/${p}`}>{TOPICS.find(t => t.id === p)?.title}</Link>)}</div>
          <Citations items={citations(["medline-anatomy", "nci-terms"])} /></div></div></div></>);
}
