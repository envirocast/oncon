import { MAP, REFS, type Status } from "@/lib/literature";
const LABEL: Record<Status, string> = { measured: "Measured here", inspired: "Design inspiration", untested: "Not tested" };
export default function Literature() {
  const n = (id: string) => REFS.findIndex(r => r.id === id) + 1;
  return (<>
    <div className="eyebrow">Research · Literature</div><h1>Where each design choice comes from</h1>
    <p>Each component of the system, the idea behind it, and how far this project has actually checked it. Most of the system is inspired by theory but not yet tested on real children, and the table says so.</p>
    <div className="callout"><b>Evidence limits.</b> Institutional sources below link to their published pages. The older theory and journal references have not been independently checked in this project; verify bibliographic details before formal citation. The communication choices are evidence-informed design, not validated teaching prescriptions for any diagnosis or age group.</div>
    <div className="wrap"><table><thead><tr><th>Component</th><th>Idea behind it</th><th>Sources</th><th>Status</th></tr></thead><tbody>
      {MAP.map(m => <tr key={m.part}><td><b>{m.part}</b><div className="muted">{m.what}</div></td><td>{m.theory}<div className="muted" style={{ marginTop: 4 }}>{m.note}</div></td><td>{m.refs.map(r => `[${n(r)}]`).join(" ")}</td><td><span className="tag">{LABEL[m.status]}</span></td></tr>)}</tbody></table></div>
    <div className="card" style={{ marginTop: 22 }}><h2>References</h2><ol style={{ paddingLeft: "1.3em", margin: 0 }}>{REFS.map(r => <li key={r.id} style={{ margin: "8px 0", fontSize: "var(--t2)" }}>{r.url ? <><a href={r.url} target="_blank" rel="noopener noreferrer">{r.cite}</a> <span className="muted">· linked source</span></> : r.cite}</li>)}</ol></div>
  </>);
}
