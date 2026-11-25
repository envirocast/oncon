import { describe, expect, it } from "vitest";
import { summarizeTopicJourney } from "@/lib/journey";

describe("procedure journey progress", () => {
  const quiz = [{ q: "Which choice?", options: ["Not sure", "Ask the team"], answer: 1 }];

  it("reports only actions that were actually recorded", () => {
    expect(summarizeTopicJourney("mri", [], {}, quiz)).toEqual({
      guideViewed: false,
      walkthroughStarted: false,
      walkthroughCompleted: false,
      stageIndex: 0,
      quizAnswered: 0,
      quizCorrect: 0,
      quizTotal: 1,
    });
  });

  it("counts valid answers and ignores corrupted or out-of-range stored answers", () => {
    const result = summarizeTopicJourney("mri", ["mri"], {
      mri: { stageIndex: 2, startedAt: "2026-01-01", completedAt: "2026-01-02", quizAnswers: { 0: 1, 1: 0, 2: 99 } },
    }, quiz);
    expect(result).toMatchObject({
      guideViewed: true,
      walkthroughStarted: true,
      walkthroughCompleted: true,
      stageIndex: 2,
      quizAnswered: 1,
      quizCorrect: 1,
      quizTotal: 1,
    });
  });
});
