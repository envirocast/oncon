"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { useChat, type Convo } from "@/lib/chat";
import { TOPICS } from "@/lib/content";
import { adaptLabel } from "@/lib/report";

function activityTime(convo: Convo) {
  const replies = convo.msgs.flatMap(message => message.reply?.ts ? [message.reply.ts] : []);
  return replies.sort().at(-1) ?? convo.ts;
}

export default function PersonalizationHistory() {
  const router = useRouter();
  const { convos, select, ready } = useChat();
  const [query, setQuery] = useState("");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const visible = useMemo(() => convos
    .filter(convo => `${convo.title} ${convo.msgs.map(message => message.text).join(" ")} ${convo.msgs.map(message => message.reply?.topicId ?? "").join(" ")}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => activityTime(b).localeCompare(activityTime(a))), [convos, query]);
  if (!ready) return null;

  const toggleCompare = (id: string) => setCompareIds(current => current.includes(id)
    ? current.filter(item => item !== id)
    : current.length < 2 ? [...current, id] : current);
  const openReport = (id: string) => { select(id); router.push("/report"); };
  const selected = compareIds.map(id => convos.find(convo => convo.id === id)).filter((convo): convo is Convo => Boolean(convo));
  const stats = (convo: Convo) => {
    const replies = convo.msgs.flatMap(message => message.reply ? [message.reply] : []);
    const topics = [...new Set(replies.map(reply => reply.topicId).filter((id): id is string => Boolean(id)))];
    return {
      questions: convo.msgs.filter(message => message.role === "user").length,
      answers: replies.length,
      adaptations: replies.reduce((count, reply) => count + reply.adaptations.length, 0),
      topics: topics.map(id => TOPICS.find(topic => topic.id === id)?.title ?? id),
      feedback: convo.msgs.filter(message => message.feedback).length,
      methods: [...new Set(replies.map(reply => reply.model ?? "Built-in templates"))],
    };
  };

  return <>
    <div className="eyebrow">Your learning record</div>
    <h1>Personalization history</h1>
    <p className="muted" style={{ maxWidth: 720 }}>Review saved conversations and the adaptations recorded for each answer. This history is stored in this browser; it is not a clinical record or a validated assessment.</p>
    <label htmlFor="history-search">Search your conversations</label>
    <div style={{ position: "relative", maxWidth: 620, marginBottom: 20 }}>
      <Search size={16} aria-hidden style={{ position: "absolute", left: 12, top: 12, color: "var(--muted)" }} />
      <input id="history-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search titles, questions, or topics" style={{ paddingLeft: 38 }} />
    </div>
    {compareIds.length > 0 && <p className="muted">Choose one more conversation to compare ({compareIds.length}/2 selected). Comparisons are descriptive, not evidence that an adaptation caused a change.</p>}
    {selected.length === 2 && <div className="card">
      <h2>Conversation comparison</h2>
      <div className="wrap"><table><thead>      <tr><th>Measure</th>{selected.map(convo => <th key={convo.id}>{convo.title || "Conversation"}</th>)}</tr></thead>
        <tbody>{(["questions", "answers", "adaptations", "feedback"] as const).map(key => <tr key={key}><th>{key === "feedback" ? "Feedback ratings" : key[0].toUpperCase() + key.slice(1)}</th>{selected.map(convo => <td key={convo.id}>{stats(convo)[key]}</td>)}</tr>)}
          <tr><th>Topics</th>{selected.map(convo => <td key={convo.id}>{stats(convo).topics.join(", ") || "None recorded"}</td>)}</tr>
          <tr><th>Methods</th>{selected.map(convo => <td key={convo.id}>{stats(convo).methods.join(", ") || "None recorded"}</td>)}</tr>
        </tbody></table></div>
      <button className="btn alt" style={{ marginTop: 12 }} onClick={() => setCompareIds([])}>Clear comparison</button>
    </div>}
    {!visible.length ? <div className="card"><h2>{convos.length ? "No matching conversations" : "No conversations yet"}</h2><p className="muted">{convos.length ? "Try another search." : "Start a chat and your saved learning history will appear here."}</p></div> :
      visible.map(convo => {
        const detail = stats(convo);
        const inComparison = compareIds.includes(convo.id);
        return <article className="card" key={convo.id}>
          <div className="row" style={{ justifyContent: "space-between", marginTop: 0 }}>
            <div><h2>{convo.title || "Conversation"}</h2><p className="muted" style={{ margin: 0 }}>{new Date(activityTime(convo)).toLocaleString()} · {detail.questions} questions · {detail.answers} recorded answers</p></div>
            <label style={{ margin: 0, fontWeight: 400 }}><input type="checkbox" checked={inComparison} disabled={!inComparison && compareIds.length >= 2} onChange={() => toggleCompare(convo.id)} /> Compare</label>
          </div>
          <div className="chips" style={{ marginTop: 12 }}>
            {detail.topics.map(topic => <span className="tagl" key={topic}>{topic}</span>)}
            {detail.methods.map(method => <span className="tagl" key={method}>{method}</span>)}
            <span className="tagl">{detail.adaptations} adaptations</span>
            <span className="tagl">{detail.feedback} feedback ratings</span>
          </div>
          {detail.adaptations > 0 && <p className="muted">Recorded adaptations: {[...new Set(convo.msgs.flatMap(message => message.reply?.adaptations ?? []))].map(adaptLabel).join(", ")}</p>}
          <div className="row">
            <button className="btn" onClick={() => openReport(convo.id)}>Open detailed report <ArrowRight size={15} /></button>
            <button className="btn alt" onClick={() => { select(convo.id); router.push("/chat"); }}>Continue conversation</button>
          </div>
        </article>;
      })}
  </>;
}
