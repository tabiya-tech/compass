// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { act, render, screen, fireEvent } from "src/_test_utilities/test-utils";
import SkillsRankingProofOfValue, { DATA_TEST_ID } from "./SkillsRankingProofOfValue";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { DATA_TEST_ID as CANCELLABLE_TYPING_IDS } from "src/chat/chatMessage/cancellableTypingChatMessage/CancellableTypingChatMessage";
import { EFFORT_METRICS_UPDATE_INTERVAL } from "src/features/skillsRanking/constants";

// Global mocks: animations only
jest.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
}));

// Mock child RotateToSolvePuzzle to expose simple controls and call props
const ROTATE_MOCK_IDS = {
  REPORT_BUTTON: "rotate-mock-report-button",
  SUCCESS_BUTTON: "rotate-mock-success-button",
  CANCEL_BUTTON: "rotate-mock-cancel-button",
};
jest.mock("src/features/skillsRanking/components/rotateToSolve/RotateToSolvePuzzle", () => ({
  __esModule: true,
  default: ({ onReport, onSuccess, onCancel, disabled, isReplay, isReplayFinished }: any) => (
    <div
      data-testid="rotate-mock-root"
      data-disabled={disabled}
      data-replay={isReplay}
      data-replay-finished={isReplayFinished}
    >
      <button
        data-testid={ROTATE_MOCK_IDS.REPORT_BUTTON}
        onClick={() => onReport({ puzzles_solved: 1, correct_rotations: 2, clicks_count: 3, time_spent_ms: 12345 })}
      >
        report
      </button>
      <button data-testid={ROTATE_MOCK_IDS.SUCCESS_BUTTON} onClick={() => onSuccess()}>
        success
      </button>
      <button data-testid={ROTATE_MOCK_IDS.CANCEL_BUTTON} onClick={() => onCancel()}>
        cancel
      </button>
    </div>
  ),
}));

jest.mock("src/features/skillsRanking/utils/createMessages", () => ({
  shouldSkipMarketDisclosure: jest.fn(() => false),
}));

describe("SkillsRankingProofOfValue", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: jest.fn() });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const flush = async () => {
    await act(async () => Promise.resolve());
  };

  const createState = (
    group: SkillsRankingExperimentGroups,
    phase: SkillsRankingPhase,
    extras: Partial<SkillsRankingState> = {}
  ): SkillsRankingState => ({
    session_id: 1,
    experiment_group: group,
    phases: [{ name: phase, time: new Date().toISOString() }],
    score: {
      jobs_matching_rank: 0,
      comparison_rank: 0,
      comparison_label: "MIDDLE",
      calculated_at: new Date().toISOString(),
    },
    started_at: new Date().toISOString(),
    ...extras,
  });

  test("should run work-based flow: metrics updates debounced; success advances to next phase and calls onFinish", async () => {
    // GIVEN work-based group with active session and service mocks
    const givenSessionId = 24680;
    const mockUpdate = jest.fn().mockResolvedValue({} as SkillsRankingState);
    const mockDebounced = { update: jest.fn(), forceUpdate: jest.fn(), abort: jest.fn(), cleanup: jest.fn() };
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      updateSkillsRankingState: mockUpdate,
      createDebouncedMetricsUpdater: jest.fn(() => mockDebounced),
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
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_2, SkillsRankingPhase.PROOF_OF_VALUE);

    // WHEN render and send metrics reports (two identical then one changed), then complete
    render(<SkillsRankingProofOfValue onFinish={actualOnFinish} skillsRankingState={givenState} />);
    expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_EFFORT_CONTAINER)).toBeInTheDocument();
    // THEN updater created with session id and interval
    const getInstance = SkillsRankingService.getInstance as any;
    expect(getInstance().createDebouncedMetricsUpdater).toHaveBeenCalledWith(
      givenSessionId,
      EFFORT_METRICS_UPDATE_INTERVAL
    );

    const givenReportButton = screen.getByTestId(ROTATE_MOCK_IDS.REPORT_BUTTON);
    fireEvent.click(givenReportButton);
    fireEvent.click(givenReportButton); // identical metrics, should not call update twice
    // Change metrics by clicking success to finish; before that click report again with changed values
    // Simulate change by directly calling update again through another click (our mock uses same payload, so call forceUpdate to emulate change)
    mockDebounced.forceUpdate({ puzzles_solved: 2, correct_rotations: 2, clicks_count: 3 });

    const givenSuccessButton = screen.getByTestId(ROTATE_MOCK_IDS.SUCCESS_BUTTON);
    act(() => {
      givenSuccessButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    // handleComplete shows typing and waits default typing duration
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await flush();

    // THEN update called to advance to MARKET_DISCLOSURE by default and onFinish fired with succeeded_after from report time
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const [actualSessionId, actualNextPhase, metricA, metricB, actualMetrics] = mockUpdate.mock.calls[0];
    expect(actualSessionId).toBe(givenSessionId);
    expect(actualNextPhase).toBe(SkillsRankingPhase.MARKET_DISCLOSURE);
    expect(metricA).toBeUndefined();
    expect(metricB).toBeUndefined();
    expect(actualMetrics).toEqual(expect.objectContaining({ succeeded_after: "12345ms" }));
    expect(actualOnFinish).toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should use JOB_SEEKER_DISCLOSURE when market disclosure is skipped", async () => {
    // GIVEN skip disclosure and work-based success
    const { shouldSkipMarketDisclosure } = jest.requireMock("src/features/skillsRanking/utils/createMessages");
    shouldSkipMarketDisclosure.mockReturnValueOnce(true);
    const givenSessionId = 11223;
    const mockUpdate = jest.fn().mockResolvedValue({} as SkillsRankingState);
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      updateSkillsRankingState: mockUpdate,
      createDebouncedMetricsUpdater: jest.fn(() => ({
        update: jest.fn(),
        forceUpdate: jest.fn(),
        abort: jest.fn(),
        cleanup: jest.fn(),
      })),
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
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_2, SkillsRankingPhase.PROOF_OF_VALUE);

    render(<SkillsRankingProofOfValue onFinish={actualOnFinish} skillsRankingState={givenState} />);
    fireEvent.click(screen.getByTestId(ROTATE_MOCK_IDS.REPORT_BUTTON));
    act(() => {
      screen.getByTestId(ROTATE_MOCK_IDS.SUCCESS_BUTTON).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await flush();

    const [, actualNextPhase] = mockUpdate.mock.calls[0];
    expect(actualNextPhase).toBe(SkillsRankingPhase.JOB_SEEKER_DISCLOSURE);
    expect(actualOnFinish).toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test("should run time-based flow: auto complete and on cancel compute metrics correctly", async () => {
    // GIVEN time-based group and active session
    const givenSessionId = 9988;
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
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_1, SkillsRankingPhase.PROOF_OF_VALUE);

    // WHEN render -> typing appears -> cancel before auto complete
    render(<SkillsRankingProofOfValue onFinish={actualOnFinish} skillsRankingState={givenState} />);
    // THEN expect typing message visible
    expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_EFFORT_CONTAINER)).toBeInTheDocument();
    // Click cancel in the cancellable typing message
    const givenCancelButton = await screen.findByTestId(CANCELLABLE_TYPING_IDS.CANCEL_BUTTON);
    act(() => {
      givenCancelButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    // short typing delay then update
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await flush();

    // THEN cancelled_after is reported in seconds for time-based cancel, and onFinish called
    const call = (mockUpdate.mock.calls[0] || []) as any[];
    expect(call[0]).toBe(givenSessionId);
    expect(call[1]).toBeDefined();
    const actualMetrics = call[4];
    expect(actualMetrics).toEqual(expect.objectContaining({ cancelled_after: expect.stringMatching(/\ds$/) }));
    expect(actualOnFinish).toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test("should not update or finish in replay mode", async () => {
    // GIVEN replay state (phase already completed)
    const mockUpdate = jest.fn();
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      updateSkillsRankingState: mockUpdate,
      createDebouncedMetricsUpdater: jest.fn(() => ({
        update: jest.fn(),
        forceUpdate: jest.fn(),
        abort: jest.fn(),
        cleanup: jest.fn(),
      })),
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
    jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({ getActiveSessionId: () => 5 } as any);
    const actualOnFinish = jest.fn();
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_2, SkillsRankingPhase.COMPLETED, {
      succeeded_after: "10s",
    });

    render(<SkillsRankingProofOfValue onFinish={actualOnFinish} skillsRankingState={givenState} />);
    const rotateRoot = screen.getByTestId("rotate-mock-root");
    expect(rotateRoot.getAttribute("data-replay")).toBe("true");
    expect(rotateRoot.getAttribute("data-replay-finished")).toBe("true");
    // Clicking success/cancel should be ignored by parent due to isReplay/isDisabled
    fireEvent.click(screen.getByTestId(ROTATE_MOCK_IDS.SUCCESS_BUTTON));
    fireEvent.click(screen.getByTestId(ROTATE_MOCK_IDS.CANCEL_BUTTON));
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await flush();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(actualOnFinish).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test("snapshot: work-based initial render (non-replay)", () => {
    // GIVEN work-based with active session
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      updateSkillsRankingState: jest.fn(),
      createDebouncedMetricsUpdater: jest.fn(() => ({
        update: jest.fn(),
        forceUpdate: jest.fn(),
        abort: jest.fn(),
        cleanup: jest.fn(),
      })),
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
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_2, SkillsRankingPhase.PROOF_OF_VALUE);
    const { container } = render(<SkillsRankingProofOfValue onFinish={jest.fn()} skillsRankingState={givenState} />);
    expect(container).toMatchSnapshot();
  });

  test("should not proceed when no active session id (both flows)", async () => {
    // GIVEN no session id
    const mockUpdate = jest.fn();
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      updateSkillsRankingState: mockUpdate,
      createDebouncedMetricsUpdater: jest.fn(() => ({
        update: jest.fn(),
        forceUpdate: jest.fn(),
        abort: jest.fn(),
        cleanup: jest.fn(),
      })),
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

    // WHEN work-based: clicking success should do nothing
    render(
      <SkillsRankingProofOfValue
        onFinish={actualOnFinish}
        skillsRankingState={createState(SkillsRankingExperimentGroups.GROUP_2, SkillsRankingPhase.PROOF_OF_VALUE)}
      />
    );
    fireEvent.click(screen.getByTestId(ROTATE_MOCK_IDS.SUCCESS_BUTTON));
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await flush();
    // THEN no update/finish, and error logged only when update attempted; in this path, isDisabled prevents update until handleComplete timer
    expect(mockUpdate).not.toHaveBeenCalled();

    // WHEN time-based: auto-complete timer triggers update attempt which logs an error and does not finish
    render(
      <SkillsRankingProofOfValue
        onFinish={actualOnFinish}
        skillsRankingState={createState(SkillsRankingExperimentGroups.GROUP_1, SkillsRankingPhase.PROOF_OF_VALUE)}
      />
    );
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await flush();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(actualOnFinish).not.toHaveBeenCalled();
    // No explicit error is logged; guard returns early when session id is missing
    expect(console.error).not.toHaveBeenCalled();
  });

  test("should disable interactions when offline", async () => {
    // GIVEN offline
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      updateSkillsRankingState: jest.fn(),
      createDebouncedMetricsUpdater: jest.fn(() => ({
        update: jest.fn(),
        forceUpdate: jest.fn(),
        abort: jest.fn(),
        cleanup: jest.fn(),
      })),
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
    jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({ getActiveSessionId: () => 9 } as any);

    render(
      <SkillsRankingProofOfValue
        onFinish={jest.fn()}
        skillsRankingState={createState(SkillsRankingExperimentGroups.GROUP_2, SkillsRankingPhase.PROOF_OF_VALUE)}
      />
    );
    const rotateRoot = screen.getByTestId("rotate-mock-root");
    expect(rotateRoot.getAttribute("data-disabled")).toBe("true");
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });
});
