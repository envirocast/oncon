import { TOPICS, type Level, type Topic } from "./content";
import { citations, type Citation } from "./sources";

const LEVELS: Level[] = ["6-8", "9-11", "12-14", "15-17"];
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const strings = (value: unknown, maxItems: number, maxLength: number): string[] | null => {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim() || item.length > maxLength) return null;
    result.push(item);
  }
  return result;
};

export interface ContentVersion {
  id: string;
  topicId: string;
  version: number;
  topic: Topic;
  sourceIds: string[];
  references: Citation[];
  status: string;
  createdBy: string | null;
  createdAt: string;
}

export function parseContentVersion(row: unknown): ContentVersion | null {
  if (!isRecord(row) || typeof row.id !== "string" || typeof row.topic_id !== "string"
    || typeof row.version !== "number" || !Number.isInteger(row.version) || typeof row.status !== "string"
    || (row.created_by !== null && typeof row.created_by !== "string") || typeof row.created_at !== "string"
    || !Array.isArray(row.source_ids) || !row.source_ids.every(id => typeof id === "string")) return null;
  const topic = row.payload;
  if (!isKnownTopicId(row.topic_id) || !isRecord(topic) || topic.id !== row.topic_id || typeof topic.title !== "string" || topic.title.length > 200) return null;
  const keywords = strings(topic.keywords, 80, 100);
  const steps = strings(topic.steps, 40, 1000);
  const terms = strings(topic.terms, 100, 100);
  const questions = strings(topic.questions, 60, 500);
  if (!keywords?.length || !steps?.length || !terms || !questions || typeof topic.example !== "string" || topic.example.length > 1000) return null;
  const whyRecord = topic.why;
  if (!isRecord(whyRecord) || LEVELS.some(level => {
    const text = whyRecord[level];
    return typeof text !== "string" || !text.trim() || text.length > 2000;
  })) return null;
  const why = {} as Record<Level, string>;
  for (const level of LEVELS) {
    const text = whyRecord[level];
    if (typeof text !== "string") return null;
    why[level] = text;
  }
  const sourceIds = row.source_ids.filter((id): id is string => typeof id === "string");
  const references = citations(sourceIds);
  if (!references.length || references.length !== new Set(sourceIds).size || references.length !== sourceIds.length) return null;
  return {
    id: row.id,
    topicId: row.topic_id,
    version: row.version,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    sourceIds,
    references,
    topic: { id: row.topic_id, title: topic.title, keywords, why, steps, terms, questions, example: topic.example },
  };
}

export function isKnownTopicId(id: string): boolean {
  return TOPICS.some(topic => topic.id === id);
}
