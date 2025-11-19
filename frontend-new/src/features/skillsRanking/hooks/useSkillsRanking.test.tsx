// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { act, renderHook } from "src/_test_utilities/test-utils";
import { useSkillsRanking } from "./useSkillsRanking";
import { IChatMessage } from "src/chat/Chat.types";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { SkillsRankingExperimentGroups, SkillsRankingPhase, SkillsRankingState } from "src/features/skillsRanking/types";

type MessagePayload = { onContinue?: (state: any) => Promise<void> | void; onDone?: (state: any) => Promise<void> | void };

const DummyMessageComponent: React.FC<MessagePayload> = () => React.createElement("div");

const makeMessage = (id: string, payload: MessagePayload): IChatMessage<MessagePayload> => ({
  type: id,
  message_id: id,
  sender: ConversationMessageSender.COMPASS,
  payload,
  component: (props: MessagePayload) => React.createElement(DummyMessageComponent, props),
});

jest.mock("src/features/skillsRanking/utils/createMessages", () => ({
  createBriefingMessage: jest.fn((_s: unknown, next: unknown) => makeMessage("brief", { onContinue: next as MessagePayload["onContinue"] })),
  createEffortMessage: jest.fn((_s: unknown, next: unknown) => makeMessage("effort", { onContinue: next as MessagePayload["onContinue"] })),
  createJobSeekerDisclosureMessage: jest.fn((_s: unknown, next: unknown) => makeMessage("jobseeker", { onContinue: next as MessagePayload["onContinue"] })),
  createPerceivedRankMessage: jest.fn((_s: unknown, next: unknown) => makeMessage("perceived", { onContinue: next as MessagePayload["onContinue"] })),
  createPromptMessage: jest.fn((_s: unknown, next: unknown) => makeMessage("prompt", { onContinue: next as MessagePayload["onContinue"] })),
}));

const defaultScore = {
  above_average_labels: [],
  below_average_labels: [],
  most_demanded_label: "",
  most_demanded_percent: 0,
  least_demanded_label: "",
  least_demanded_percent: 0,
  average_percent_for_jobseeker_skillgroups: 0,
  average_count_for_jobseeker_skillgroups: 0,
  province_used: "",
  matched_skillgroups: 0,
  calculated_at: new Date().toISOString(),
};

const createState = (group: SkillsRankingExperimentGroups, phases: SkillsRankingPhase[]): SkillsRankingState => {
  const phaseHistory = phases.map((name) => ({ name, time: new Date().toISOString() }));
  return {
    phase: phaseHistory,
    score: defaultScore,
    metadata: {
      session_id: 1,
      experiment_group: group,
      started_at: new Date().toISOString(),
    },
    user_responses: {},
  };
};

describe("useSkillsRanking", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  
  const advancePhase = async (
    message: IChatMessage<MessagePayload> | undefined,
    group: SkillsRankingExperimentGroups,
    current: SkillsRankingPhase,
    next: SkillsRankingPhase
  ) => {
    await act(async () => {
      await message?.payload.onContinue?.(createState(group, [current, next]));
    });
  };

  test("replays phases and advances through the flow", async () => {
    const group = SkillsRankingExperimentGroups.GROUP_2;
    const mockGetState = jest.fn().mockResolvedValue(
      createState(group, [SkillsRankingPhase.INITIAL, SkillsRankingPhase.BRIEFING])
    );
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      getSkillsRankingState: mockGetState,
      updateSkillsRankingState: jest.fn(),
    } as unknown as SkillsRankingService);
    jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({ getActiveSessionId: () => 123 } as any);

    const addedMessages: Array<IChatMessage<MessagePayload>> = [];
    const addMessage = (m: IChatMessage<MessagePayload>) => addedMessages.push(m);
    const onFinish = jest.fn();

    const { result } = renderHook(() => useSkillsRanking(addMessage, () => {}));
    await act(async () => {
      await result.current.showSkillsRanking(onFinish);
    });

    expect(addedMessages.map((m) => m.type)).toEqual(expect.arrayContaining(["prompt", "brief"]));

    const brief = addedMessages.find((m) => m.type === "brief");
    await advancePhase(brief, group, SkillsRankingPhase.BRIEFING, SkillsRankingPhase.PROOF_OF_VALUE);
    expect(addedMessages.map((m) => m.type)).toContain("effort");

    const effort = addedMessages.find((m) => m.type === "effort");
    await advancePhase(effort, group, SkillsRankingPhase.PROOF_OF_VALUE, SkillsRankingPhase.DISCLOSURE);
    expect(addedMessages.map((m) => m.type)).toContain("jobseeker");

    const disclosure = addedMessages.find((m) => m.type === "jobseeker");
    await advancePhase(disclosure, group, SkillsRankingPhase.DISCLOSURE, SkillsRankingPhase.PERCEIVED_RANK);
    expect(addedMessages.map((m) => m.type)).toContain("perceived");

    const perceived = addedMessages.find((m) => m.type === "perceived");
    await advancePhase(perceived, group, SkillsRankingPhase.PERCEIVED_RANK, SkillsRankingPhase.COMPLETED);
    expect(onFinish).toHaveBeenCalled();
  });

  test("initializes when no state exists", async () => {
    const mockGetState = jest.fn().mockResolvedValue(null);
    const mockInitState = createState(SkillsRankingExperimentGroups.GROUP_1, [SkillsRankingPhase.INITIAL]);
    const mockInit = jest.fn().mockResolvedValue(mockInitState);
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      getSkillsRankingState: mockGetState,
      updateSkillsRankingState: mockInit,
    } as unknown as SkillsRankingService);
    jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({ getActiveSessionId: () => 456 } as any);

    const addedMessages: Array<IChatMessage<MessagePayload>> = [];
    const addMessage = (m: IChatMessage<MessagePayload>) => addedMessages.push(m);
    const onFinish = jest.fn();

    const { result } = renderHook(() => useSkillsRanking(addMessage, () => {}));
    await act(async () => {
      await result.current.showSkillsRanking(onFinish);
    });

    expect(mockInit).toHaveBeenCalledWith(456, SkillsRankingPhase.INITIAL);
    expect(addedMessages.map((m) => m.type)).toContain("prompt");
  });

  test("handles missing session id by throwing an error", async () => {
    jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({ getActiveSessionId: () => null } as any);

    const { result } = renderHook(() => useSkillsRanking(() => {}, () => {}));

    await expect(result.current.showSkillsRanking(jest.fn())).rejects.toThrow("Active session ID is not available.");
  });
});
