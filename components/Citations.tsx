import type { Citation } from "@/lib/sources";

export default function Citations({ items, label = "Sources" }: { items: Citation[]; label?: string }) {
  if (!items.length) return null;
  return <section className="citations" aria-label={label}>
    <b>{label}</b>
    <ul>{items.map(source => <li key={source.id}>
      <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>
      <span className="muted"> · {source.publisher}</span>
    </li>)}</ul>
  </section>;
}
