"use client";
import { useEffect, useState } from "react";
import { REMOTE, notifyWrite } from "./syncbus";
import { DEFAULT_PROFILE, type Profile, type Reply } from "./engine";
import { DEFAULT_MEMORY, type Memory } from "./memory";
import type { Citation } from "./sources";

export interface Msg { id: string; role: "user" | "bot"; text: string; reply?: Reply; feedback?: "up" | "down" | "simpler" | "detail"; stopped?: boolean; }
export interface Saved { questions: Record<string, string[]>; understood: string[]; }

function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
export function useLocal<T>(key: string, fallback: T): [T, (v: T | ((p: T) => T)) => void, boolean] {
  const [val, setVal] = useState<T>(fallback);
  const [ready, setReady] = useState(false);
  useEffect(() => { setVal(load(key, fallback)); setReady(true); /* eslint-disable-next-line */ }, [key]);
  useEffect(() => { const h = (e: Event) => { if ((e as CustomEvent).detail?.key === key) setVal(load(key, fallback)); }; addEventListener(REMOTE, h); return () => removeEventListener(REMOTE, h); /* eslint-disable-next-line */ }, [key]);
  const set = (v: T | ((p: T) => T)) => setVal(prev => {
    const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
    try { localStorage.setItem(key, JSON.stringify(next)); notifyWrite(key); } catch {}
    return next;
  });
  return [val, set, ready];
}
export const useProfile = () => useLocal<Profile>("onc.profile", DEFAULT_PROFILE);
export const useSaved = () => useLocal<Saved>("onc.saved", { questions: {}, understood: [] });
export interface LogEvent { id: string; session: string; signals?: string[]; levelShift?: number; targetGrade?: number | null; ts: string; age: string; detail: string; format: string[]; topic: string | null; adaptations: string[]; source: string | null; coverage: number | null; grade: number | null; words: number | null; model: string; promptVersion: string; safety: string | null; clarification: string | null; feedback: string | null; lang?: string; mode?: string; }
export interface Bookmark { id: string; title: string; text: string; ts: string; references?: Citation[]; }
export const useLog = () => useLocal<LogEvent[]>("onc.log", []);
export const useBookmarks = () => useLocal<Bookmark[]>("onc.bookmarks", []);

export interface Feeling { id: string; ts: string; emoji: string; label: string; note: string; concern: string; }
export const useFeelings = () => useLocal<Feeling[]>("onc.feelings", []);
export interface QItem { id: string; text: string; cat: string; answered: boolean; }
export const useQs = () => useLocal<QItem[]>("onc.qs", []);
export interface StudyRow { id: string; ts: string; pid: string; condition: "adapted" | "generic"; topic: string; age: string; score: number; total: number; selfRated: number; ms: number; grade: number | null; }
export const useStudy = () => useLocal<StudyRow[]>("onc.study", []);
export interface Rating { id: string; topic: string; decision: string; accuracy: number; ageFit: number; safety: number; comment: string; rater: string; ts: string; }
export const useRatings = () => useLocal<Rating[]>("onc.ratings", []);
export interface ProcedureProgress { stageIndex: number; startedAt?: string; completedAt?: string; quizAnswers?: Record<number, number>; }
export const useProcedureProgress = () => useLocal<Record<string, ProcedureProgress>>("onc.procedures", {});
export const useViewed = () => useLocal<string[]>("onc.viewed", []);
export const useWordsSaved = () => useLocal<string[]>("onc.words", []);
export const useChecked = () => useLocal<Record<string, boolean>>("onc.plan", {});
export const useMemory = () => useLocal<Memory>("onc.memory", DEFAULT_MEMORY);
