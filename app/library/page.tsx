"use client";
import { useBookmarks } from "@/lib/store";
import Citations from "@/components/Citations";
export default function Library() {
  const [marks, setMarks, ready] = useBookmarks();
  if (!ready) return null;
  return (<><div className="eyebrow">Library</div><h1>Saved explanations</h1>
    {!marks.length && <p className="muted">Nothing saved yet. Use the bookmark button under any answer in the chat.</p>}
    {marks.map(b => <div className="card" key={b.id}><h3>{b.title}</h3><p style={{ whiteSpace: "pre-wrap" }}>{b.text}</p>
      <Citations items={b.references ?? []} />
      <div className="muted">{new Date(b.ts).toLocaleString()}</div>
      <div className="row"><button className="btn alt sm" onClick={() => window.print()}>Print</button><button className="btn alt sm" onClick={() => setMarks(m => m.filter(x => x.id !== b.id))}>Remove</button></div></div>)}</>);
}
