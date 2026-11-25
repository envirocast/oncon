"use client";
import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, Volume2 } from "lucide-react";
import { WORDS } from "@/lib/more";
import { useWordsSaved } from "@/lib/store";
import { wordCitations } from "@/lib/sources";
import Citations from "@/components/Citations";
export default function Words() {
  const [q, setQ] = useState(""); const [cat, setCat] = useState("All"); const [letter, setLetter] = useState(""); const [saved, setSaved] = useWordsSaved(); const [only, setOnly] = useState(false); const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { const p = new URLSearchParams(location.search).get("q"); if (p) { setQ(p); setOpen(p.toLowerCase()); } }, []);
  const cats = ["All", ...new Set(WORDS.map(w => w.cat))];
  const list = WORDS.filter(w => (cat === "All" || w.cat === cat) && (!letter || w.term[0].toUpperCase() === letter) && (!only || saved.includes(w.term)) && (w.term + w.simple).toLowerCase().includes(q.toLowerCase()));
  const speak = (t: string) => { const s = window.speechSynthesis; if (!s) return; s.cancel(); s.speak(new SpeechSynthesisUtterance(t)); };
  const letters = [...new Set(WORDS.map(w => w.term[0].toUpperCase()))];
  return (<><div className="eyebrow">Vocabulary builder</div><h1>Medical words</h1>
    <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Search words…" aria-label="Search words" />
    <div className="chips" style={{ margin: "12px 0" }}>{cats.map(c => <button key={c} className={"chip" + (cat === c ? " on" : "")} onClick={() => setCat(c)}>{c}</button>)}<button className={"chip" + (only ? " on" : "")} onClick={() => setOnly(o => !o)}>★ Saved ({saved.length})</button></div>
    <div className="chips" style={{ marginBottom: 16 }}>{letters.map(l => <button key={l} className={"chip" + (letter === l ? " on" : "")} style={{ padding: "2px 10px" }} onClick={() => setLetter(letter === l ? "" : l)}>{l}</button>)}</div>
    {list.map(w => <div className="card" key={w.term} style={{ padding: 18 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}><h3 style={{ margin: 0, textTransform: "capitalize", flex: 1 }}>{w.term} <span className="tag">{w.cat}</span></h3>
        <button className="btn alt sm" onClick={() => speak(w.term)} aria-label={`Pronounce ${w.term}`}><Volume2 size={15} /></button>
        <button className="btn alt sm" onClick={() => setSaved(s => s.includes(w.term) ? s.filter(x => x !== w.term) : [...s, w.term])} aria-label="Save word">{saved.includes(w.term) ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}</button></div>
      <p style={{ margin: "8px 0" }}>{w.simple}</p>
      <button className="btn alt sm" onClick={() => setOpen(open?.toLowerCase() === w.term.toLowerCase() ? null : w.term)}>{open?.toLowerCase() === w.term.toLowerCase() ? "Less" : "More"}</button>
      {open?.toLowerCase() === w.term.toLowerCase() && <div style={{ marginTop: 10 }}><p>{w.detail}</p><p className="muted">{w.example}</p><div className="chips">{w.related.map(r => <button key={r} className="chip" onClick={() => { setQ(r); setOpen(r.toLowerCase()); window.scrollTo?.({ top: 0 }); }}>{r}</button>)}</div><Citations items={wordCitations(w.cat)} /></div>}</div>)}
    {!list.length && <p className="muted">No matches.</p>}</>);
}
