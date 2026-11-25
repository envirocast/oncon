import Link from "next/link";
import { TOPICS } from "@/lib/content";
export default function Procedures() {
  return (<><div className="eyebrow">Procedure and treatment explorer</div><h1>Understand a procedure or treatment</h1>
    <p className="muted" style={{ maxWidth: 640 }}>Each guide covers why it may be done, what equipment is used, what usually happens before, during and after, and questions to ask. Different procedures follow different sequences, so check with your care team about yours.</p>
    <div className="feat" style={{ marginTop: 20 }}>{TOPICS.map(t => <Link key={t.id} href={`/procedures/${t.id}`} className="card" style={{ textDecoration: "none", color: "inherit", marginBottom: 0 }}><h3>{t.title}</h3><p className="muted" style={{ margin: 0 }}>{t.why["9-11"].split(". ")[0]}.</p></Link>)}</div></>);
}
