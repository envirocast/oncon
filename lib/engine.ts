import { GLOSSARY, SOURCE, TOPICS, type Level, type Topic } from "./content";
import { applySignals, detectSignals, DEFAULT_MEMORY, type Memory, type Signal } from "./memory";
import { citations, topicCitations, type Citation } from "./sources";

export type LearningPreference = "short_chunks" | "literal" | "predictable" | "visual" | "low_sensory";
export const LEARNING_PREFERENCES: { id: LearningPreference; label: string; description: string }[] = [
  { id: "short_chunks", label: "Short chunks", description: "Short paragraphs and one idea at a time" },
  { id: "literal", label: "Literal wording", description: "Avoid idioms and explain any figures of speech" },
  { id: "predictable", label: "Predictable order", description: "Explain what may happen before, during, and after" },
  { id: "visual", label: "Structured layout", description: "Use clear lists and numbered steps" },
  { id: "low_sensory", label: "Gentle sensory detail", description: "Keep sound, touch, and other sensory descriptions brief unless I ask" },
];

export interface Profile {
  role: "child" | "caregiver" | "together";
  age: Level;
  detail: "short" | "balanced" | "detailed";
  format: ("steps" | "examples" | "define" | "check")[];
  topics: string[]; concerns: string[]; notes: string; updatedAt: string; lang?: string; learningPreferences?: LearningPreference[];
}
export const DEFAULT_PROFILE: Profile = { role: "child", age: "9-11", detail: "balanced", format: ["define", "examples"], topics: [], concerns: [], notes: "", updatedAt: "", lang: "en", learningPreferences: [] };

export interface TraceStep { n: number; name: string; call: string; result: string; status: "ok" | "adapted" | "triggered" | "skipped"; }
export interface Plan { level: Level; effDetail: 0 | 1 | 2; steps: boolean; examples: boolean; define: boolean; alt: boolean; targetGrade: number; maxWords: number; }
export interface Reply {
  text: string; topicId: string | null; used: string[]; changed: string[]; notDone: string[]; adaptations: string[]; safety: string | null; source: string | null; references?: Citation[];
  id?: string; ts?: string; model?: string; promptVersion?: string; metrics?: import("./metrics").Metrics; coverage?: number;
  trace: TraceStep[]; memory: Memory; signals: Signal[]; plan?: Plan; lang?: string; mode?: "adaptive" | "baseline" | "age"; stopped?: boolean;
}

const ADVICE = /\b(should i|do i need|do i have to|dose|dosage|how much (medicine|medication)|will i (die|survive)|am i going to (die|be ok)|stop (taking|my)|is it safe for me|prognosis|survival rate)\b/i;
const DISTRESS = /\b(hurt myself|kill myself|want to die|don'?t want to live|suicid|self.?harm|scared of dying|i'?m (so )?scared|i can'?t do this)\b/i;
const ORDER: Level[] = ["6-8", "9-11", "12-14", "15-17"];
export const BASE_GRADE = [3, 5.5, 8, 11];
export const WORDS = [70, 140, 260];
const CONCERN_PROMPTS: Record<string, string> = {
  "I don't know what will happen": "You can ask your care team what usually happens before, during, and after.",
  "I'm confused about medical words": "You can ask your care team to explain any words that are still unclear.",
  "I'm worried about pain or discomfort": "You can ask your care team what comfort options are planned.",
  "I'm worried about missing school": "You can ask your care team or school contact how appointments may affect school.",
  "I have questions I don't know how to ask": "The Questions page can help you prepare what to say to your care team.",
};

export function matchTopic(q: string): { topic: Topic; keyword: string } | null {
  const normalized = normalize(q);
  if (!normalized) return null;

  const aliases: Record<string, string[]> = {
    ct: ["cat scan", "ct scan", "computerized tomography", "computerised tomography"],
    mri: ["magnetic resonance", "magnetic resonance imaging", "mri scan"],
    pet: ["pet ct", "pet/ct", "pet scan", "positron emission tomography"],
    xray: ["x ray", "x-ray", "xray", "radiograph", "chest x ray"],
    cbc: ["complete blood count", "cbc", "blood cell count"],
    "bone-marrow": ["bone marrow aspiration", "bone marrow biopsy", "marrow biopsy", "bone marrow test"],
    "lumbar-puncture": ["lumbar puncture", "spinal tap", "lp procedure"],
    "side-effects": ["side effect", "side effects", "treatment side effects", "treatment side effect"],
    "clinical-trial": ["clinical trial", "clinical trials", "cancer study", "research study"],
  };
  const tokens = normalized.split(" ").filter(Boolean);
  let best: { topic: Topic; keyword: string; score: number } | null = null;

  for (const topic of TOPICS) {
    const candidates = [...topic.keywords, ...(aliases[topic.id] ?? [])];
    for (const candidate of candidates) {
      const keyword = normalize(candidate);
      if (!keyword) continue;
      const keywordTokens = keyword.split(" ").filter(Boolean);
      const exact = normalized === keyword || normalized.includes(keyword);
      const tokenCoverage = keywordTokens.filter(kToken => tokens.some(tToken =>
        tToken === kToken || editDistance(tToken, kToken) <= (kToken.length >= 7 ? 2 : kToken.length >= 4 ? 1 : 0)
      )).length / keywordTokens.length;
      const score = exact ? 100 + keyword.length : tokenCoverage * 100;
      if (score >= 80 && (!best || score > best.score)) {
        best = { topic, keyword: candidate, score };
      }
    }
  }
  return best ? { topic: best.topic, keyword: best.keyword } : null;
}

export function matchMedicalWord(q: string): { term: string; definition: string } | null {
  const normalized = normalize(q);
  if (!normalized) return null;
  let best: { term: string; definition: string; length: number } | null = null;
  for (const [term, definition] of Object.entries(GLOSSARY)) {
    const key = normalize(term);
    if (normalized === key || normalized.includes(key)) {
      if (!best || key.length > best.length) best = { term, definition, length: key.length };
    }
  }
  return best ? { term: best.term, definition: best.definition } : null;
}

function normalize(q: string): string {
  return q.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bc t\b/g, "ct")
    .replace(/\bm r i\b/g, "mri")
    .replace(/\bmr i\b/g, "mri")
    .replace(/\bp e t\b/g, "pet")
    .replace(/\s+/g, " ").trim();
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return Math.abs(a.length - b.length);
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    for (let j = 0; j <= b.length; j++) previous[j] = current[j];
  }
  return previous[b.length];
}
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function respond(question: string, p: Profile, lastTopic: string | null, memIn: Memory = DEFAULT_MEMORY, topicOverride?: Topic): Reply {
  const trace: TraceStep[] = []; const add = (name: string, call: string, result: string, status: TraceStep["status"] = "ok") => trace.push({ n: trace.length + 1, name, call, result, status });
  const base = { used: [] as string[], changed: [] as string[], adaptations: [] as string[], safety: null as string | null, source: null as string | null, topicId: null as string | null };
  const notDone = ["Did not verify your personal diagnosis.", "Did not decide whether you need any procedure.", "Did not make treatment recommendations."];

  add("RECEIVE", `receive(question)`, `${question.length} chars, ${(question.match(/\S+/g) ?? []).length} words`);
  const distress = DISTRESS.test(question);
  add("SAFETY_SCAN", `match(DISTRESS_PATTERNS, question)`, distress ? "distress language detected, stop personalization and redirect" : "no distress language", distress ? "triggered" : "ok");
  if (distress) {
    add("REDIRECT", `respond(trusted_adult_message)`, "fixed safety message, model not called", "triggered");
    return { ...base, notDone, trace, memory: memIn, signals: [], safety: "SUPPORT_REDIRECT", adaptations: ["SAFETY_SUPPORT_REDIRECT"],
      references: citations(["988-lifeline"]),
      text: "I'm really glad you told me. Feeling scared or overwhelmed is okay, and you don't have to handle it alone. Please tell a trusted adult, like a parent, nurse or doctor, right now. If you are in danger or thinking about hurting yourself, tell an adult immediately or call your local emergency number (in the US, call or text 988)." };
  }

  const m = matchTopic(question);
  let topic = m?.topic ?? null; let how = m ? `keyword "${m.keyword}" → ${m.topic.id}` : "no keyword matched";
  if (topic && topicOverride?.id === topic.id) topic = topicOverride;
  const follow = !topic && lastTopic && /again|more|why|what happens|simpl|detail|confus|understand|shorter|longer|example|step/i.test(question);
  if (follow) {
    topic = TOPICS.find(t => t.id === lastTopic) ?? null;
    if (topic && topicOverride?.id === topic.id) topic = topicOverride;
    how = `follow-up, carried over previous topic → ${lastTopic}`;
  }

  const signals = detectSignals(question);
  add("DETECT_SIGNALS", `detect(question, SIGNAL_PATTERNS)`, signals.length ? signals.join(", ") : "none", signals.length ? "adapted" : "ok");
  const { memory, changed } = applySignals(memIn, signals, topic?.id ?? null);
  add("UPDATE_MEMORY", `memory ← apply(signals, memory)`, changed.length ? changed.join("; ") : "no change", changed.length ? "adapted" : "ok");
  add("TOPIC_MATCH", `match_topic(question, last_topic=${lastTopic ?? "∅"})`, how, topic ? "ok" : "skipped");
  const advice = ADVICE.test(question);
  add("ADVICE_CHECK", `match(INDIVIDUAL_ADVICE, question)`, advice ? "personal medical question, add care-team redirect" : "general education", advice ? "triggered" : "ok");

  // Level + depth + strategy selection
  const ageIdx = ORDER.indexOf(p.age); const shift = Math.round(memory.levelShift);
  const lvlIdx = clamp(ageIdx + shift, 0, 3); const level = ORDER[lvlIdx];
  const detailIdx = ({ short: 0, balanced: 1, detailed: 2 } as const)[p.detail];
  const effDetail = clamp(detailIdx + Math.round(memory.lengthBias), 0, 2) as 0 | 1 | 2;
  const confRepeat = topic ? (memory.confusion[topic.id] ?? 0) >= 2 : false;
  const preferences = p.learningPreferences ?? [];
  const plan: Plan = {
    level, effDetail,
    steps: p.format.includes("steps") || memory.scaffold >= 1 || effDetail === 2 || memory.stepAffinity >= 2 || preferences.includes("predictable") || preferences.includes("visual"),
    examples: !preferences.includes("literal") && (p.format.includes("examples") || memory.scaffold >= 1 || lvlIdx === 0 || memory.exampleAffinity >= 2 || confRepeat),
    define: p.format.includes("define") || memory.scaffold >= 2,
    alt: confRepeat,
    targetGrade: BASE_GRADE[lvlIdx], maxWords: WORDS[effDetail],
  };
  add("SELECT_LEVEL", `level = clamp(index(age=${p.age}) + round(level_shift=${memory.levelShift}), 0, 3)`, `${ageIdx} + ${shift} → ${lvlIdx} = ages ${level}`, shift ? "adapted" : "ok");
  add("SELECT_DEPTH", `depth = clamp(index(${p.detail}) + round(length_bias=${memory.lengthBias}), 0, 2)`, `${detailIdx} + ${Math.round(memory.lengthBias)} → ${effDetail} (${["short", "balanced", "detailed"][effDetail]}), cap ${plan.maxWords} words`, memory.lengthBias ? "adapted" : "ok");
  add("SELECT_STRATEGY", `strategy(scaffold=${memory.scaffold}, example_pref=${memory.exampleAffinity}, step_pref=${memory.stepAffinity}, repeat_confusion=${confRepeat})`,
    `steps=${plan.steps}, examples=${plan.examples}, define=${plan.define}${plan.alt ? ", ALTERNATE: analogy first" : ""}, target grade ≈ ${plan.targetGrade}`, plan.alt || memory.scaffold >= 1 ? "adapted" : "ok");

  if (!topic) {
    add("RETRIEVE", `retrieve(source_linked_content, topic=∅)`, "no supported source-linked topic matched; no model answer generated", "skipped");
    const word = matchMedicalWord(question);
    if (word) {
      add("MEDICAL_WORD", `match_glossary(question)`, `${word.term} → plain-language definition`, "ok");
      return { ...base, notDone, trace, memory, signals, plan, adaptations: ["VOCABULARY_DEFINED"],
        text: `${word.term}: ${word.definition}\n\nThis is general education, not advice about your own care.`,
        used: [`The medical word "${word.term}" was matched in the built-in glossary.`],
        changed: ["Defined the medical word in plain language."] };
    }
    const plain = normalize(question);
    if (/^(hi|hello|hey|good morning|good afternoon|good evening)[!.]?$/i.test(plain)) {
      add("CONVERSATION", `match(greeting, question)`, "friendly greeting, offered supported subjects", "ok");
      return { ...base, notDone, trace, memory, signals, plan,
        text: "Hi! Ask me about a procedure, scan, blood test, cancer treatment, or another supported medical topic. I can also explain a medical word.",
        used: ["A greeting was recognized."], changed: ["Answered directly instead of listing every topic."] };
    }
    if (/^(thanks|thank you|thx)[!.]?$/i.test(plain)) {
      add("CONVERSATION", `match(thanks, question)`, "acknowledgement", "ok");
      return { ...base, notDone, trace, memory, signals, plan,
        text: "You're welcome. Ask if you want to understand another topic or medical word.",
        used: ["A thanks message was recognized."], changed: ["Answered directly."] };
    }
    return { ...base, notDone, trace, memory, signals, plan, safety: advice ? "INDIVIDUAL_ADVICE_REDIRECT" : null, adaptations: advice ? ["SAFETY_INDIVIDUAL_ADVICE_REDIRECT"] : [],
      text: (advice ? "That's an important question, and it's best answered by your own healthcare team because they know your situation. " : "") +
        "I don't have enough information to match that to a supported topic. Which one would you like to learn about? Name a topic such as MRI, CT scan, biopsy, blood test, or chemotherapy. You can also ask what a medical word means." };
  }
  add("RETRIEVE", `retrieve(source_linked_content, topic=${topic.id})`, `${topic.id}: ${Object.keys(topic.why).length} level texts, ${topic.steps.length} steps, ${topic.terms.length} terms, ${topicCitations(topic.id).length} source links`);

  const adaptations = ["DEVELOPMENTAL_ADAPTATION"];
  const used = [`Your selected age range: ${p.age}.`, `Your selected topic: ${topic.title.toLowerCase()}.`];
  const changedL = [`Used wording written for ages ${level}.`];
  if (p.role === "caregiver") { used.push("Your selected audience: caregiver."); changedL.push("Framed the explanation for a parent or caregiver."); adaptations.push("CAREGIVER_AUDIENCE"); }
  if (p.role === "together") { used.push("Your selected audience: child and caregiver together."); changedL.push("Framed the explanation for shared reading."); adaptations.push("SHARED_AUDIENCE"); }
  const templatePreferences = preferences.filter(preference => preference !== "low_sensory");
  if (templatePreferences.length) {
    used.push(`Your stated learning preferences: ${templatePreferences.join(", ")}.`);
    changedL.push("Applied the learning and accessibility preferences supported by the template.");
    adaptations.push("STATED_LEARNING_PREFERENCES");
  }
  if (shift) { changedL.push(`Shifted the level ${shift > 0 ? "up" : "down"} based on what you said earlier (memory).`); used.push(`Chat memory: level shift ${memory.levelShift}.`); adaptations.push(shift < 0 ? "MEMORY_SIMPLIFIED" : "MEMORY_EXPANDED"); }
  if (signals.includes("SIMPLER")) { adaptations.push("SIMPLIFIED_ON_REQUEST"); used.push("Your request for a simpler explanation."); }
  if (signals.includes("MORE_DETAIL")) { adaptations.push("EXPANDED_ON_REQUEST"); used.push("Your request for more detail."); }
  if (signals.includes("CONFUSED")) { adaptations.push("CONFUSION_SCAFFOLDING"); used.push("You said something was confusing."); }
  if (plan.alt) { adaptations.push("ALTERNATE_STRATEGY"); changedL.push("Tried a different explanation (analogy first) because earlier ones didn't land."); }
  if (memory.lengthBias) { used.push(`Chat memory: length bias ${memory.lengthBias}.`); }

  let text = p.role === "caregiver" ? `For a parent or caregiver: ${topic.why[level]}` : p.role === "together" ? `You can read this together: ${topic.why[level]}` : topic.why[level];
  if (preferences.includes("short_chunks")) adaptations.push("SHORT_CHUNKS_PREFERENCE");
  if (preferences.includes("literal")) adaptations.push("LITERAL_LANGUAGE_PREFERENCE");
  if (preferences.includes("predictable")) adaptations.push("PREDICTABLE_ORDER_PREFERENCE");
  if (preferences.includes("visual")) adaptations.push("STRUCTURED_LAYOUT_PREFERENCE");
  if (effDetail === 0 && memory.lengthBias <= -1) { text = text.split(/(?<=[.!?])\s/)[0]; adaptations.push("SHORT_FORMAT"); changedL.push("Cut the explanation down to its core sentence."); }
  const exampleLine = `Think of it this way: ${topic.example}`;
  if (plan.alt && plan.examples) text = `${exampleLine}\n\n${text}`;
  if (plan.steps && effDetail > 0) {
    const nSteps = lvlIdx === 0 ? 3 : topic.steps.length;
    text += "\n\nWhat usually happens:\n" + topic.steps.slice(0, nSteps).map((s, i) => `${i + 1}. ${s}`).join("\n");
    adaptations.push("STEPWISE_EXPLANATION"); changedL.push(`Explained it in ${nSteps} steps.`); used.push("Step-by-step preference or scaffolding.");
  }
  if (plan.examples && !plan.alt && (effDetail > 0 || memory.scaffold >= 1)) { text += `\n\n${exampleLine}`; adaptations.push("EXAMPLE_ADDED"); changedL.push("Added a familiar comparison."); used.push("Example preference or scaffolding."); }
  if (plan.define) {
    const n = effDetail === 0 ? 1 : effDetail === 1 ? 3 : 5;
    text += "\n\nWords to know:\n" + topic.terms.slice(0, n).map(id => `• ${id}: ${GLOSSARY[id]}`).join("\n");
    adaptations.push("VOCABULARY_DEFINED"); changedL.push("Defined medical words."); used.push("Your request for medical words to be explained.");
  }
  const concernPrompt = p.concerns.map(concern => CONCERN_PROMPTS[concern]).find(Boolean);
  if (concernPrompt) {
    text += `\n\nYou mentioned a concern. ${concernPrompt}`;
    used.push(`Your selected concern: ${p.concerns.find(concern => CONCERN_PROMPTS[concern])}.`);
    changedL.push("Added a relevant question prompt for the concern you selected.");
    adaptations.push("STATED_CONCERN_CONTEXT");
  }
  if (advice) { text += "\n\nQuestions about what is right for you personally are best answered by your healthcare team. The Questions page can help you write them down."; adaptations.push("SAFETY_INDIVIDUAL_ADVICE_REDIRECT"); }
  if (p.format.includes("check")) text += "\n\nDid that make sense? You can say \"simpler\", \"more detail\", \"shorter\" or \"I don't understand\".";
  text += "\n\nThis is general education, not advice about your own care.";
  if (preferences.includes("short_chunks")) {
    const [opening, ...sections] = text.split("\n\n");
    text = [opening.split(/(?<=[.!?])\s+/).join("\n\n"), ...sections].join("\n\n");
  }
  return { ...base, text, topicId: topic.id, used, changed: changedL, notDone, adaptations, trace, memory, signals, plan, safety: advice ? "INDIVIDUAL_ADVICE_REDIRECT" : null, source: `${SOURCE.title}: ${topic.title} (${SOURCE.reviewed})`, references: topicCitations(topic.id) };
}
