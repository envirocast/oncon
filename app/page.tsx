"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Starfield from "@/components/landing/Starfield";
import Md from "@/components/Md";
import { DEFAULT_PROFILE, respond } from "@/lib/engine";
import { DEFAULT_MEMORY } from "@/lib/memory";
import { metrics } from "@/lib/metrics";

const AGES = [["6-8", "6 to 8"], ["9-11", "9 to 11"], ["12-14", "12 to 14"], ["15-17", "15 to 17"]] as const;
const ASKS = ["What is an MRI?", "What happens during a biopsy?", "What is a CT scan?", "What is a blood test for?"];
const STEPS: [string, string][] = [
  ["Profile", "Age band, preferred detail, language and notes set the starting reading level."],
  ["Memory", "Saying “simpler” or “I don't get it” shifts later answers, and the shift is stored per topic."],
  ["Generate", "A language model may rewrite matched, source-linked content; unsupported topics are not answered from general model knowledge."],
  ["Check", "Reading grade, length and safety are measured against the target, and every step is logged."],
];
const RESEARCH: [string, string, string][] = [
  ["/eval", "Evaluation harness", "A three-arm ablation (control, age band only, full profile) and a test of whether chat memory persists, with bootstrap intervals and Holm-adjusted p-values."],
  ["/protocol", "Protocol and power", "Power calculator, seeded block randomisation, counterbalancing, consent and assent templates, and a pre-registration export."],
  ["/analysis", "Data analysis", "Group comparisons on study data, clinician agreement with Cohen's kappa, and any CSV you paste in."],
  ["/literature", "Literature map", "Each design choice linked to its theory, marked as measured here, borrowed, or untested."],
  ["/paper", "Paper draft", "A write-up filled from your own results. Anything missing says so instead of being invented."],
];

/** The real engine running in the browser: same question, four readers, then what happens after “I don't get it”. */
function Demo() {
  const [age, setAge] = useState<(typeof AGES)[number][0]>("9-11"); const [q, setQ] = useState(ASKS[0]); const [after, setAfter] = useState(false);
  const { first, second } = useMemo(() => {
    const profile = { ...DEFAULT_PROFILE, age };
    const first = respond(q, profile, null, DEFAULT_MEMORY);
    const second = respond("I don't get it, can you explain that more simply?", profile, first.topicId ?? null, first.memory);
    return { first, second };
  }, [age, q]);
  const r = after ? second : first; const m = useMemo(() => metrics(r.text), [r.text]); const m1 = useMemo(() => metrics(first.text), [first.text]); const m2 = useMemo(() => metrics(second.text), [second.text]);
  const set = (fn: () => void) => () => { fn(); setAfter(false); };
  return (
    <div className="frame" id="demo">
      <div className="framebar">
        <div className="seg" role="radiogroup" aria-label="Reader age">{AGES.map(([k, l]) => <button key={k} role="radio" aria-checked={age === k} className={age === k ? "on" : ""} onClick={set(() => setAge(k))}>{l}</button>)}</div>
        <div className="seg" role="radiogroup" aria-label="Question">{ASKS.map(a => <button key={a} role="radio" aria-checked={q === a} className={q === a ? "on" : ""} onClick={set(() => setQ(a))}>{a}</button>)}</div>
      </div>
      <div className="framebody">
        <div className="answer">
          <div className="who">Child, ages {age.replace("-", " to ")}</div><p className="q">{q}</p>
          {after && <><div className="who">Reader</div><p className="q">I don&apos;t get it, can you explain that more simply?</p></>}
          <div className="who">Onconnect</div>
          <div className="text" key={r.text}><Md text={r.text} /></div>
          <button className="pillbtn" onClick={() => setAfter(a => !a)}>{after ? "Back to the first answer" : "Reply: “I don't get it”"}</button>
        </div>
        <dl className="metrics">
          <div><dt>Target reading grade</dt><dd>{r.plan?.targetGrade ?? "n/a"}</dd></div>
          <div><dt>Measured grade</dt><dd>{m.grade}</dd></div>
          <div><dt>Words</dt><dd>{m.words}</dd></div>
          <div><dt>Adaptations</dt><dd className="small">{r.adaptations.length ? r.adaptations.map(a => a.replaceAll("_", " ").toLowerCase()).join(", ") : "none"}</dd></div>
          {after && <div><dt>After “I don&apos;t get it”</dt><dd className="small">Grade {m1.grade} to {m2.grade}. Memory carried: level shift {second.memory.levelShift}, scaffolding {second.memory.scaffold}.</dd></div>}
        </dl>
      </div>
      <div className="framefoot">Runs in your browser on the built-in source-linked content engine, so you are seeing real numbers, not a mock-up. The live chat uses a language model only when a source-linked topic matches.</div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="lp">
      <header className="lpnav">
        <Link href="/" className="logo" aria-label="Onconnect"><span className="mark"><i /></span>Onconnect</Link>
        <nav aria-label="Sections"><a href="#demo">Product</a><a href="#how">How it works</a><a href="#research">Research</a><a href="#care">Care</a></nav>
        <span className="grow" />
        <Link href="/account" className="pbtn dark">Log in</Link><Link href="/chat" className="pbtn light">Open Onconnect <ArrowUpRight size={15} /></Link>
      </header>

      <section className="lphero">
        <Starfield />
        <h1 className="display"><span>Explained</span><span>for you</span></h1>
        <div className="herofoot">
          <p>Onconnect explains procedures and scans to children with cancer and their families, rewrites each answer for the reader, and records how every answer was made.</p>
          <div className="heroctas"><Link href="/chat" className="pbtn light">Ask a question <ArrowRight size={15} /></Link><a href="#demo" className="pbtn dark">See it adapt</a></div>
        </div>
      </section>

      <section className="lpsec"><div className="lpcol"><div className="eyebrow">Live demo</div><h2 className="big">Same question. Different reader.</h2></div>
        <Demo />
      </section>

      <section className="lpsec"><div className="lpcol narrow">
        <p className="lead">A child of eight and a teenager of sixteen should not get the same explanation of an MRI. Onconnect writes for the reader in front of it, adjusts when they say it was too hard or too long, and shows its work.</p>
        <p className="note"><em>Prototype.</em> Content is a draft pending clinician review. Onconnect is general education, not advice about anyone&apos;s own care.</p>
      </div></section>

      <section className="lpsec" id="how"><div className="lpcol"><div className="eyebrow">How it works</div><h2 className="big">Four steps, every one logged.</h2>
        <div className="rows">{STEPS.map(([t, d], i) => <div key={t} className="row4"><span className="n">0{i + 1}</span><h3>{t}</h3><p>{d}</p></div>)}</div>
        <Link href="/report" className="textlink">Read an algorithm report <ArrowRight size={14} /></Link></div></section>

      <section className="lpsec" id="research"><div className="lpcol"><div className="eyebrow">Research</div><h2 className="big">Measured, not claimed.</h2>
        <p className="sub">The research tools are part of the product. Run the experiments, export the data, and the paper draft fills itself from what you actually measured.</p>
        <div className="rows">{RESEARCH.map(([h, t, d]) => <Link key={h} href={h} className="row3"><h3>{t}</h3><p>{d}</p><ArrowUpRight size={18} /></Link>)}</div>
        <p className="note">Nothing on this page claims an outcome. Results appear in the tools above only after you have run them.</p></div></section>

      <section className="lpsec" id="care"><div className="lpcol"><div className="eyebrow">Care</div><h2 className="big">Built to be trusted with children.</h2>
        <div className="three">
          <div><h3>Local first</h3><p>Your profile, chats and notes stay in your browser unless you sign in to sync them. Pseudonymized research measurements are a separate, off-by-default choice; they are not anonymous.</p></div>
          <div><h3>Honest about limits</h3><p>It will not diagnose, give doses or discuss prognosis. Safety rules run before and after the model, and the answer says when it is only general education.</p></div>
          <div><h3>Open to review</h3><p>Answers show mapped sources and adaptation details. With the database workflow configured, role-verified clinicians can review staged educational topic versions; they do not rate personal chats or see patient records.</p></div>
        </div></div></section>

      <section className="lpend"><h2 className="big">Ask your first question.</h2><Link href="/chat" className="pbtn light lg">Open Onconnect <ArrowUpRight size={16} /></Link></section>
      <footer className="lpfoot"><span>Onconnect, a research prototype for general education. Not a medical device.</span><span className="grow" /><Link href="/privacy">Privacy</Link><Link href="/method">Method</Link><Link href="/account">Account</Link></footer>
    </div>
  );
}
