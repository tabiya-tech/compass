// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { act, render, screen, fireEvent, waitFor } from "src/_test_utilities/test-utils";
import SkillsRankingRetypedRank, { DATA_TEST_ID } from "./SkillsRankingRetypedRank";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";

jest.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
}));

// Mock the slider component to a simple range input that forwards onChange(event, value)
jest.mock("src/features/skillsRanking/components/skillsRankingSlider/SkillsRankingSlider", () => ({
  __esModule: true,
  default: ({ onChange, value, ...props }: any) => (
    <input
      type="range"
      data-testid={props["data-testid"]}
      aria-label={props["aria-label"]}
      value={value}
      onChange={(e: any) => onChange(e, Number(e.target.value))}
      onInput={(e: any) => onChange(e, Number(e.target.value))}
    />
  ),
}));

jest.mock("src/features/skillsRanking/utils/createMessages", () => ({
  shouldSkipMarketDisclosure: jest.fn(() => false),
}));

describe("SkillsRankingRetypedRank", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: jest.fn(),
    });
    // Ensure disclosure is not skipped by default
    const { shouldSkipMarketDisclosure } = jest.requireMock("src/features/skillsRanking/utils/createMessages");
    shouldSkipMarketDisclosure.mockReturnValue(false);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const flush = async () => {
    await act(async () => Promise.resolve());
  };

  const createState = (phase: SkillsRankingPhase, retyped?: number): SkillsRankingState => ({
    session_id: 1,
    experiment_group: SkillsRankingExperimentGroups.GROUP_2,
    phases: [{ name: phase, time: new Date().toISOString() }],
    score: {
      jobs_matching_rank: 0,
      comparison_rank: 0,
      comparison_label: "MIDDLE",
      calculated_at: new Date().toISOString(),
    },
    started_at: new Date().toISOString(),
    retyped_rank_percentile: retyped,
  });

  const setSliderValue = (value: number) => {
    const input = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_RETYPED_RANK_SLIDER) as HTMLInputElement;
    input.value = String(value);
    fireEvent.input(input, { target: { value: String(value) } });
    fireEvent.change(input, { target: { value: String(value) } });
  };

  test("should submit retyped rank and call service then onFinish (non-replay)", async () => {
    // GIVEN service mocks and a session id
    const givenSessionId = 55555;
    const mockUpdate = jest.fn().mockResolvedValue({} as SkillsRankingState);
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      updateSkillsRankingState: mockUpdate,
      getConfig: () => ({
        config: {
          compensationAmount: "$1",
          jobPlatformUrl: "x",
          shortTypingDurationMs: 1,
          defaultTypingDurationMs: 1,
          longTypingDurationMs: 1,
        },
      }),
    } as unknown as SkillsRankingService);
    jest
      .spyOn(UserPreferencesStateService, "getInstance")
      .mockReturnValue({ getActiveSessionId: () => givenSessionId } as any);
    const actualOnFinish = jest.fn().mockResolvedValue(undefined);
    const givenState = createState(SkillsRankingPhase.RETYPED_RANK);

    // WHEN render and change slider and submit
    render(<SkillsRankingRetypedRank onFinish={actualOnFinish} skillsRankingState={givenState} />);
    setSliderValue(55);
    await flush();
    const givenSubmitButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_RETYPED_RANK_SUBMIT_BUTTON);
    await waitFor(() => expect(givenSubmitButton).not.toBeDisabled());
    act(() => {
      givenSubmitButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // THEN expect service and onFinish after typing delays
    act(() => {
      jest.runOnlyPendingTimers();
    }); // hide typing
    await flush();
    act(() => {
      jest.runOnlyPendingTimers();
    }); // call onFinish
    await flush();
    expect(mockUpdate).toHaveBeenCalledWith(givenSessionId, SkillsRankingPhase.COMPLETED, undefined, 55);
    expect(actualOnFinish).toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test("should auto-complete when market disclosure is skipped (effect path)", async () => {
    // GIVEN disclosure skipped
    const { shouldSkipMarketDisclosure } = jest.requireMock("src/features/skillsRanking/utils/createMessages");
    shouldSkipMarketDisclosure.mockReturnValue(true);
    const givenSessionId = 77777;
    const mockUpdate = jest.fn().mockResolvedValue({} as SkillsRankingState);
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      updateSkillsRankingState: mockUpdate,
      getConfig: () => ({
        config: {
          compensationAmount: "$1",
          jobPlatformUrl: "x",
          shortTypingDurationMs: 1,
          defaultTypingDurationMs: 1,
          longTypingDurationMs: 1,
        },
      }),
    } as unknown as SkillsRankingService);
    jest
      .spyOn(UserPreferencesStateService, "getInstance")
      .mockReturnValue({ getActiveSessionId: () => givenSessionId } as any);
    const actualOnFinish = jest.fn().mockResolvedValue(undefined);
    const givenState = createState(SkillsRankingPhase.RETYPED_RANK, 23);

    // WHEN render (component returns empty but effect runs)
    render(<SkillsRankingRetypedRank onFinish={actualOnFinish} skillsRankingState={givenState} />);
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await flush();

    // THEN service called and onFinish invoked
    // value remains 0 in RETYPED_RANK (state is not synced from props)
    expect(mockUpdate).toHaveBeenCalledWith(givenSessionId, SkillsRankingPhase.COMPLETED, 0);
    expect(actualOnFinish).toHaveBeenCalled();
  });

  test("should not proceed when no active session id", async () => {
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      updateSkillsRankingState: jest.fn(),
      getConfig: () => ({
        config: {
          compensationAmount: "$1",
          jobPlatformUrl: "x",
          shortTypingDurationMs: 1,
          defaultTypingDurationMs: 1,
          longTypingDurationMs: 1,
        },
      }),
    } as unknown as SkillsRankingService);
    jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({ getActiveSessionId: () => null } as any);
    const actualOnFinish = jest.fn();
    const givenState = createState(SkillsRankingPhase.RETYPED_RANK);

    render(<SkillsRankingRetypedRank onFinish={actualOnFinish} skillsRankingState={givenState} />);
    setSliderValue(10);
    const givenSubmitButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_RETYPED_RANK_SUBMIT_BUTTON);
    await waitFor(() => expect(givenSubmitButton).not.toBeDisabled());
    act(() => {
      givenSubmitButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(console.error).toHaveBeenCalled();
    expect(actualOnFinish).not.toHaveBeenCalled();
  });

  test("should ignore submit in replay mode", async () => {
    const mockUpdate = jest.fn();
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      updateSkillsRankingState: mockUpdate,
      getConfig: () => ({
        config: {
          compensationAmount: "$1",
          jobPlatformUrl: "x",
          shortTypingDurationMs: 1,
          defaultTypingDurationMs: 1,
          longTypingDurationMs: 1,
        },
      }),
    } as unknown as SkillsRankingService);
    jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({ getActiveSessionId: () => 1 } as any);
    const givenState = createState(SkillsRankingPhase.COMPLETED);

    render(<SkillsRankingRetypedRank onFinish={jest.fn()} skillsRankingState={givenState} />);
    const givenSubmitButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_RETYPED_RANK_SUBMIT_BUTTON);
    expect(givenSubmitButton).toBeDisabled();
    act(() => {
      givenSubmitButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test("snapshot: initial render in RETYPED_RANK (non-replay)", () => {
    // GIVEN default state in RETYPED_RANK
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      updateSkillsRankingState: jest.fn(),
      getConfig: () => ({
        config: {
          compensationAmount: "$1",
          jobPlatformUrl: "x",
          shortTypingDurationMs: 1,
          defaultTypingDurationMs: 1,
          longTypingDurationMs: 1,
        },
      }),
    } as unknown as SkillsRankingService);
    jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({ getActiveSessionId: () => 1 } as any);
    const givenState = createState(SkillsRankingPhase.RETYPED_RANK);

    // WHEN render
    const { container } = render(<SkillsRankingRetypedRank onFinish={jest.fn()} skillsRankingState={givenState} />);

    // THEN expect snapshot to match
    expect(container).toMatchSnapshot();
  });
});
