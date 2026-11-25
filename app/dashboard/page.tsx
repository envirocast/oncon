"use client";
import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat } from "@/lib/chat";
import { TOPICS } from "@/lib/content";
import { useBookmarks, useChecked, useFeelings, useMemory, useProfile, useViewed } from "@/lib/store";

export default function Dashboard() {
  const router = useRouter(); const { convos, select, ready } = useChat();
  const [profile, setProfile, pr] = useProfile(); const [viewed] = useViewed(); const [marks] = useBookmarks(); const [done, setDone] = useChecked(); const [mem] = useMemory(); const [feel] = useFeelings();
  if (!ready || !pr) return null;
  const hr = new Date().getHours(); const hello = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
  const plan = profile.topics; const finished = plan.filter(id => done[id]).length;
  const move = (i: number, d: number) => { const a = [...plan]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setProfile({ ...profile, topics: a }); };
  const next = TOPICS.filter(t => !viewed.includes(t.id) && !plan.includes(t.id)).slice(0, 3);
  const daily = TOPICS[new Date().getDate() % TOPICS.length];
  return (<>
    <div className="eyebrow">Dashboard</div><h1>{hello}.</h1>
    <p className="muted">{profile.updatedAt ? `Profile: ages ${profile.age}, ${profile.detail} detail. Last updated ${new Date(profile.updatedAt).toLocaleDateString()}.` : <>You haven&apos;t built a profile yet. <Link href="/setup">Build one</Link> so explanations fit you.</>}</p>
    <div className="kpi"><div><b>{viewed.length}</b><span>Topics explored</span></div><div><b>{marks.length}</b><span>Saved explanations</span></div><div><b>{convos.length}</b><span>Conversations</span></div><div><b>{feel.length}</b><span>Check-ins</span></div></div>
    <div className="dashgrid">
      <div className="card"><h2>My learning plan</h2>
        {plan.length === 0 ? <p className="muted">No topics yet. Pick some in <Link href="/setup">My profile</Link>.</p> : <>
          <div className="bar" style={{ margin: "6px 0 12px" }}><i style={{ width: `${(finished / plan.length) * 100}%` }} /></div><p className="muted">{finished} of {plan.length} done</p>
          {plan.map((id, i) => <div key={id} className="step" style={{ alignItems: "center" }}><input type="checkbox" checked={!!done[id]} onChange={() => setDone({ ...done, [id]: !done[id] })} aria-label={`Mark ${id} done`} />
            <span style={{ flex: 1 }}><Link href={`/procedures/${id}`}>{TOPICS.find(t => t.id === id)?.title}</Link><div className="muted">Recommended because you selected it.</div></span>
            <button className="btn alt sm" onClick={() => move(i, -1)} aria-label="Move up"><ChevronUp size={14} /></button><button className="btn alt sm" onClick={() => move(i, 1)} aria-label="Move down"><ChevronDown size={14} /></button></div>)}</>}
        <p className="muted"><Link href="/journey">View activity-based care journey</Link> · walkthroughs and topic activity are tracked separately from these checkboxes.</p>
      </div>
      <div className="card"><h2>Continue learning</h2>
        {viewed.length ? <div className="chips">{viewed.slice(0, 5).map(id => <Link key={id} href={`/procedures/${id}`} className="chip" style={{ textDecoration: "none" }}>{TOPICS.find(t => t.id === id)?.title}</Link>)}</div> : <p className="muted">Topics you ask about will show up here.</p>}
        <h3 style={{ marginTop: 16 }}>Suggested next</h3><div className="chips">{next.map(t => <Link key={t.id} href={`/procedures/${t.id}`} className="chip" style={{ textDecoration: "none" }}>{t.title}</Link>)}</div>
        <h3 style={{ marginTop: 16 }}>Today&apos;s suggestion</h3><p>Learn about <Link href={`/procedures/${daily.id}`}>{daily.title.toLowerCase()}</Link>.</p></div></div>
    <div className="card"><h2>Recent conversations and reports</h2>
      {convos.length === 0 ? <p className="muted">No conversations yet.</p> : convos.slice(0, 4).map(c => <div key={c.id} className="step" style={{ alignItems: "center" }}><span style={{ flex: 1 }}>{c.title}<div className="muted">{new Date(c.ts).toLocaleDateString()} · {c.msgs.filter(m => m.role === "user").length} questions</div></span>
        <button className="btn alt sm" onClick={() => { select(c.id); router.push("/report"); }}>Report</button><button className="btn alt sm" onClick={() => { select(c.id); router.push("/chat"); }}>Open</button></div>)}</div>
    <div className="card"><h2>Chat memory</h2><p className="muted">Level shift {mem.levelShift} · length bias {mem.lengthBias} · scaffolding {mem.scaffold}. <Link href="/setup">See details or reset</Link></p>
      <h2 style={{ marginTop: 16 }}>Privacy</h2><p className="muted">Your data stays in this browser. <Link href="/privacy">Export or delete it</Link></p></div></>);
}
