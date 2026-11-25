import type { Q } from "./more";
import type { ProcedureProgress } from "./store";

export interface TopicJourney {
  guideViewed: boolean;
  walkthroughStarted: boolean;
  walkthroughCompleted: boolean;
  stageIndex: number;
  quizAnswered: number;
  quizCorrect: number;
  quizTotal: number;
}

export function summarizeTopicJourney(
  topicId: string,
  viewed: string[],
  progress: Record<string, ProcedureProgress>,
  quiz: Q[],
): TopicJourney {
  const record = progress[topicId];
  const validAnswers = Object.entries(record?.quizAnswers ?? {}).filter(([question, answer]) => {
    const index = Number(question);
    return Number.isInteger(index) && index >= 0 && index < quiz.length
      && Number.isInteger(answer) && answer >= 0 && answer < quiz[index].options.length;
  });
  return {
    guideViewed: viewed.includes(topicId),
    walkthroughStarted: Boolean(record?.startedAt),
    walkthroughCompleted: Boolean(record?.completedAt),
    stageIndex: Number.isInteger(record?.stageIndex) && record.stageIndex >= 0 ? record.stageIndex : 0,
    quizAnswered: validAnswers.length,
    quizCorrect: validAnswers.filter(([question, answer]) => quiz[Number(question)].answer === answer).length,
    quizTotal: quiz.length,
  };
}
