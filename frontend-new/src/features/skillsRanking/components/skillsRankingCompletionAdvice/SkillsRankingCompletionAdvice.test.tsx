// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { act, render, screen } from "src/_test_utilities/test-utils";
import SkillsRankingCompletionAdvice, { DATA_TEST_ID } from "./SkillsRankingCompletionAdvice";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import { DATA_TEST_ID as TYPING_DATA_TEST_ID } from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";

jest.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
}));

jest.mock("src/features/skillsRanking/utils/createMessages", () => ({
  shouldSkipMarketDisclosure: jest.fn(() => false),
}));

describe("SkillsRankingCompletionAdvice", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const flush = async () => {
    await act(async () => Promise.resolve());
  };

  const createState = (phase: SkillsRankingPhase): SkillsRankingState => ({
    session_id: 1,
    experiment_group: SkillsRankingExperimentGroups.GROUP_1,
    phases: [{ name: phase, time: new Date().toISOString() }],
    score: {
      jobs_matching_rank: 0,
      comparison_rank: 0,
      comparison_label: "MIDDLE",
      calculated_at: new Date().toISOString(),
    },
    started_at: new Date().toISOString(),
  });

  test("should show advice then typing then call onFinish (non-replay)", async () => {
    // GIVEN initial flow
    const actualOnFinish = jest.fn().mockResolvedValue(undefined);
    const givenState = createState(SkillsRankingPhase.RETYPED_RANK);

    // WHEN rendering
    render(<SkillsRankingCompletionAdvice onFinish={actualOnFinish} skillsRankingState={givenState} />);

    // THEN advice container visible, no typing yet
    expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_COMPLETION_ADVICE_CONTAINER)).toBeInTheDocument();
    expect(screen.queryByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).not.toBeInTheDocument();

    // WHEN advice duration elapses -> typing shows
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

    // WHEN default typing duration elapses -> finish called
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await flush();
    expect(actualOnFinish).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should immediately call onFinish in replay mode", async () => {
    // GIVEN replay (phase COMPLETED)
    const actualOnFinish = jest.fn().mockResolvedValue(undefined);
    const givenState = createState(SkillsRankingPhase.COMPLETED);

    // WHEN rendering
    render(<SkillsRankingCompletionAdvice onFinish={actualOnFinish} skillsRankingState={givenState} />);
    await flush();

    // THEN finish is called and typing not shown
    expect(actualOnFinish).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_COMPLETION_ADVICE_CONTAINER)).toBeInTheDocument();
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should render nothing when market disclosure is skipped", () => {
    // GIVEN skip flag
    const { shouldSkipMarketDisclosure } = jest.requireMock("src/features/skillsRanking/utils/createMessages");
    shouldSkipMarketDisclosure.mockReturnValueOnce(true);
    const actualOnFinish = jest.fn();
    const givenState = createState(SkillsRankingPhase.RETYPED_RANK);

    // WHEN rendering
    const { container } = render(
      <SkillsRankingCompletionAdvice onFinish={actualOnFinish} skillsRankingState={givenState} />
    );

    // THEN container has no content
    expect(container).toBeTruthy();
    expect(container.textContent).toBe("");
  });
});
