"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity, Bone, BookOpen, Bookmark, Calculator, ChartLine, ChevronDown, ChevronsLeft, Cloud, ChevronsRight, CircleHelp, ClipboardCheck, FileText, FlaskConical, GitCompare, HeartPulse, History, LayoutDashboard, Library, Lock, Menu, MessageSquarePlus, Microscope, Moon, PenLine, Plus, Route, ScrollText, Search, ShieldCheck, Stethoscope, Sun, UserRound, Users, X, Sigma, type LucideIcon } from "lucide-react";
import { useChat } from "@/lib/chat";

const GROUPS: [string, [string, string, LucideIcon][]][] = [
  ["Learn", [["/dashboard", "Dashboard", LayoutDashboard], ["/journey", "My care journey", Route], ["/procedures", "Procedure explorer", Stethoscope], ["/anatomy", "Anatomy", Bone], ["/words", "Medical words", BookOpen]]],
  ["Support", [["/feelings", "My feelings", HeartPulse], ["/questions", "My questions", CircleHelp], ["/family", "Family & school", Users], ["/caregiver", "Caregiver portal", Users]]],
  ["Research", [["/study", "Comprehension study", FlaskConical], ["/protocol", "Protocol & power", Calculator], ["/eval", "Evaluation harness", Activity], ["/analysis", "Data analysis", Sigma], ["/research", "Research dashboard", ChartLine], ["/compare", "Compare ages", GitCompare], ["/literature", "Literature map", Library], ["/log", "Audit log", ScrollText], ["/clinician", "Clinician review", ClipboardCheck], ["/admin", "Administration", ShieldCheck], ["/method", "Method", Microscope], ["/paper", "Paper draft", PenLine]]],
  ["You", [["/personalization-history", "Personalization history", History], ["/report", "Session report", FileText], ["/library", "Saved", Bookmark], ["/setup", "My profile", UserRound], ["/account", "Account & sync", Cloud], ["/privacy", "Privacy & data", Lock]]],
];
const PAGES = GROUPS.flatMap(([, l]) => l);

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const router = useRouter(); const { convos, activeId, select, newChat, remove } = useChat();
  const [dark, setDark] = useState(false); const [size, setSize] = useState(100); const [rail, setRail] = useState(false);
  const [shut, setShut] = useState<Record<string, boolean>>({}); const [pal, setPal] = useState(false); const [q, setQ] = useState(""); const [side, setSide] = useState(false); const [find, setFind] = useState("");
  const isChat = path === "/chat";
  useEffect(() => { try { const t = localStorage.getItem("onc.theme"); setDark(t ? t === "dark" : true); setSize(Number(localStorage.getItem("onc.size")) || 100); setRail(localStorage.getItem("onc.rail") === "1"); } catch {} }, []);
  useEffect(() => { document.documentElement.dataset.theme = path === "/" || dark ? "dark" : "light"; document.documentElement.style.fontSize = `${size}%`; try { localStorage.setItem("onc.theme", dark ? "dark" : "light"); localStorage.setItem("onc.size", String(size)); localStorage.setItem("onc.rail", rail ? "1" : "0"); } catch {} }, [dark, size, rail, path]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPal(o => !o); } if (e.key === "Escape") { setPal(false); setSide(false); } };
    addEventListener("keydown", h); return () => removeEventListener("keydown", h); }, []);
  useEffect(() => setSide(false), [path]);
  const go = (h: string) => { router.push(h); setPal(false); setQ(""); };
  const items: [string, string][] = ([["/", "Landing page"], ["/chat", "New chat"], ...PAGES.map(([h, l]) => [h, l])] as [string, string][]).filter(([, l]) => l.toLowerCase().includes(q.toLowerCase()));
  const list = convos.filter(c => c.title.toLowerCase().includes(find.toLowerCase()));
  const on = (h: string) => path === h || (h !== "/" && path.startsWith(h + "/"));
  const startChat = () => { newChat(); router.push("/chat"); };

  if (path === "/") return <>{children}</>;
  return (<div className={"app" + (rail ? " railed" : "") + (isChat ? " chatmode" : "")}>
    <aside className={"side" + (side ? " open" : "") + (rail ? " rail" : "")} aria-label="Primary">
      <div className="sidetop"><Link href="/" className="logo" aria-label="Onconnect home"><span className="mark"><i /></span><span className="lbl">Onconnect</span></Link>
        <button className="ib ghost railbtn" onClick={() => setRail(r => !r)} aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}>{rail ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}</button>
        <button className="ib ghost closebtn" onClick={() => setSide(false)} aria-label="Close menu"><X size={16} /></button></div>
      <button className="newchat" onClick={startChat} title="New chat"><MessageSquarePlus size={17} /><span className="lbl">New chat</span></button>
      <button className="searchbtn" onClick={() => setPal(true)} title="Search and jump (⌘K)"><Search size={15} /><span className="lbl">Search or jump to…</span><kbd className="lbl">⌘K</kbd></button>
      <nav className="sidenav" aria-label="Sections">
        <div className="convhead lbl"><span>Chats</span><span className="muted">{convos.length}</span></div>
        <div className="convos lbl">
          {convos.length > 6 && <input className="find" type="text" placeholder="Filter chats" value={find} onChange={e => setFind(e.target.value)} aria-label="Filter chats" />}
          {list.length === 0 && <div className="muted" style={{ padding: "4px 10px" }}>{convos.length ? "No matches" : "No conversations yet"}</div>}
          {list.slice(0, 40).map(c => <div key={c.id} className={"citem" + (c.id === activeId && isChat ? " act" : "")}>
            <button onClick={() => { select(c.id); router.push("/chat"); }}>{c.title || "New chat"}</button>
            <button className="x" onClick={() => remove(c.id)} aria-label="Delete conversation"><X size={13} /></button></div>)}
        </div>
        {GROUPS.map(([g, links]) => { const hasAct = links.some(([h]) => on(h)); const closed = !rail && (shut[g] ?? !hasAct); return <div key={g} className="navgrp">
          <button className={"grp lbl" + (closed ? " shut" : "")} onClick={() => setShut(o => ({ ...o, [g]: !closed }))} aria-expanded={!closed}>{g}<ChevronDown size={13} /></button>
          {!closed && links.map(([h, l, I]) => <Link key={h} href={h} title={l} className={on(h) ? "act" : ""}><I size={17} /><span className="lbl">{l}</span></Link>)}</div>; })}
      </nav>
      <div className="sidefoot">
        <button className="ib" onClick={() => setDark(d => !d)} aria-label="Toggle dark mode" title="Toggle theme">{dark ? <Sun size={15} /> : <Moon size={15} />}</button>
        <button className="ib lbl" onClick={() => setSize(s => Math.max(85, s - 10))} aria-label="Smaller text">A−</button>
        <button className="ib lbl" onClick={() => setSize(s => Math.min(135, s + 10))} aria-label="Larger text">A+</button>
        <span className="lbl grow" /><span className="tag lbl" title="Not a medical device. Draft content.">prototype</span>
      </div>
    </aside>
    {side && <div className="scrim" onClick={() => setSide(false)} />}
    <div className="mainpane" id="main" tabIndex={-1}>
      <div className="topbar"><button className="ib" onClick={() => setSide(true)} aria-label="Open menu"><Menu size={18} /></button><Link href="/" className="logo"><span className="mark"><i /></span>Onconnect</Link><span className="grow" /><button className="ib" onClick={startChat} aria-label="New chat"><Plus size={18} /></button></div>
      {isChat ? children : <div className="page"><div className="pagein">{children}</div><footer className="foot">Onconnect is a research prototype for general education. It does not replace your doctors, nurses, or other healthcare professionals. Built-in content is draft unless an approved version is available. Data is local by default; optional cloud and sharing features require sign-in and consent.</footer></div>}
    </div>
    {pal && <div className="overlay" onClick={() => setPal(false)}><div className="pal" role="dialog" aria-label="Jump to" onClick={e => e.stopPropagation()}>
      <div className="palin"><Search size={16} /><input autoFocus type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Jump to a page…" aria-label="Jump to" onKeyDown={e => { if (e.key === "Enter" && items[0]) go(items[0][0]); }} /></div>
      {items.map(([h, l]) => <button key={h} onClick={() => go(h)}>{l}<span className="muted">{h}</span></button>)}
      {items.length === 0 && <div className="muted" style={{ padding: 12 }}>Nothing matches.</div>}</div></div>}
  </div>);
}
