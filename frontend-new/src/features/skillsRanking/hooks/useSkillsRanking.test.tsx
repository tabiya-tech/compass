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
import { skillsRankingHappyPathFull, skillsRankingHappyPathSkipped } from "./skillsRankingFlowGraph";

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
  createCompletionAdviceMessage: jest.fn((_s: unknown, onDone: unknown) => makeMessage("advice", { onDone: onDone as MessagePayload["onDone"] })),
  createEffortMessage: jest.fn((_s: unknown, next: unknown) => makeMessage("effort", { onContinue: next as MessagePayload["onContinue"] })),
  createJobMarketDisclosureMessage: jest.fn((_s: unknown, next: unknown) => makeMessage("market", { onContinue: next as MessagePayload["onContinue"] })),
  createJobSeekerDisclosureMessage: jest.fn((_s: unknown, next: unknown) => makeMessage("jobseeker", { onContinue: next as MessagePayload["onContinue"] })),
  createPerceivedRankMessage: jest.fn((_s: unknown, next: unknown) => makeMessage("perceived", { onContinue: next as MessagePayload["onContinue"] })),
  createPromptMessage: jest.fn((_s: unknown, next: unknown) => makeMessage("prompt", { onContinue: next as MessagePayload["onContinue"] })),
  createRetypedRankMessage: jest.fn((_s: unknown, next: unknown) => makeMessage("retyped", { onContinue: next as MessagePayload["onContinue"] })),
  shouldSkipMarketDisclosure: jest.fn(() => false),
}));

const createState = (group: SkillsRankingExperimentGroups, phases: SkillsRankingPhase[]): SkillsRankingState => ({
  session_id: 1,
  experiment_group: group,
  phases: phases.map((name) => ({ name, time: new Date().toISOString() })),
  score: { jobs_matching_rank: 0, comparison_rank: 0, comparison_label: "MIDDLE", calculated_at: new Date().toISOString() },
  started_at: new Date().toISOString(),
});

const advanceToNextPhase = async (options: {
  message: IChatMessage<MessagePayload> | undefined;
  group: SkillsRankingExperimentGroups;
  current: SkillsRankingPhase;
  next: SkillsRankingPhase;
}) => {
  const { message, group, current, next } = options;
  await act(async () => {
    await message?.payload.onContinue?.(createState(group, [current, next]));
  });
};


describe("useSkillsRanking", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  
  test("GROUP_1: fetch state, replay, and advance to completion advice", async () => {
    const givenExperimentGroup = SkillsRankingExperimentGroups.GROUP_1;
    const mockGetState = jest.fn().mockResolvedValue(createState(givenExperimentGroup, [SkillsRankingPhase.BRIEFING]));
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      getSkillsRankingState: mockGetState,
      updateSkillsRankingState: jest.fn(),
    } as unknown as SkillsRankingService);
    jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({ getActiveSessionId: () => 123 } as any);

    const addedMessages: Array<IChatMessage<MessagePayload>> = [];
    const addMessage = (m: IChatMessage<MessagePayload>) => addedMessages.push(m);
    const removeMessage = (_messageId: string) => {};
    const onFinish = jest.fn();

    const { result } = renderHook(() => useSkillsRanking(addMessage, removeMessage));
    await act(async () => {
      await result.current.showSkillsRanking(onFinish);
    });

    expect(addedMessages.map((m) => m.type)).toEqual(expect.arrayContaining(["brief"]));

    const brief = addedMessages.find((m) => m.type === "brief");
    await act(async () => {
      await brief?.payload.onContinue?.(createState(givenExperimentGroup, [SkillsRankingPhase.BRIEFING, SkillsRankingPhase.PROOF_OF_VALUE]));
    });
    expect(addedMessages.map((m) => m.type)).toContain("effort");

    const effort = addedMessages.find((m) => m.type === "effort");
    await act(async () => {
      await effort?.payload.onContinue?.(createState(givenExperimentGroup, [SkillsRankingPhase.PROOF_OF_VALUE, SkillsRankingPhase.MARKET_DISCLOSURE]));
    });
    expect(addedMessages.map((m) => m.type)).toContain("market");

    const market = addedMessages.find((m) => m.type === "market");
    await act(async () => {
      await market?.payload.onContinue?.(createState(givenExperimentGroup, [SkillsRankingPhase.MARKET_DISCLOSURE, SkillsRankingPhase.JOB_SEEKER_DISCLOSURE]));
    });
    expect(addedMessages.map((m) => m.type)).toContain("jobseeker");

    const jobseeker = addedMessages.find((m) => m.type === "jobseeker");
    await act(async () => {
      await jobseeker?.payload.onContinue?.(createState(givenExperimentGroup, [SkillsRankingPhase.JOB_SEEKER_DISCLOSURE, SkillsRankingPhase.PERCEIVED_RANK]));
    });
    expect(addedMessages.map((m) => m.type)).toContain("perceived");

    const perceived = addedMessages.find((m) => m.type === "perceived");
    await act(async () => {
      await perceived?.payload.onContinue?.(createState(givenExperimentGroup, [SkillsRankingPhase.PERCEIVED_RANK, SkillsRankingPhase.RETYPED_RANK]));
    });
    expect(addedMessages.map((m) => m.type)).toContain("retyped");

    const retyped = addedMessages.find((m) => m.type === "retyped");
    await act(async () => {
      await retyped?.payload.onContinue?.(createState(givenExperimentGroup, [SkillsRankingPhase.RETYPED_RANK, SkillsRankingPhase.COMPLETED]));
    });
    expect(addedMessages.map((m) => m.type)).toContain("advice");

    const advice = addedMessages.filter((m) => m.type === "advice").pop();
    await act(async () => {
      await advice?.payload.onDone?.(createState(givenExperimentGroup, [SkillsRankingPhase.COMPLETED]));
    });
    expect(onFinish).toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test("GROUP_2: fetch state, replay (skips market/retyped), and finish on advice", async () => {
    const givenExperimentGroup = SkillsRankingExperimentGroups.GROUP_2;
    const mockGetState = jest.fn().mockResolvedValue(createState(givenExperimentGroup, [SkillsRankingPhase.BRIEFING]));
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      getSkillsRankingState: mockGetState,
      updateSkillsRankingState: jest.fn(),
    } as unknown as SkillsRankingService);
    jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({ getActiveSessionId: () => 123 } as any);

    const addedMessages: Array<IChatMessage<MessagePayload>> = [];
    const addMessage = (m: IChatMessage<MessagePayload>) => addedMessages.push(m);
    const removeMessage = (_messageId: string) => {};
    const onFinish = jest.fn();

    const { result } = renderHook(() => useSkillsRanking(addMessage, removeMessage));
    await act(async () => {
      await result.current.showSkillsRanking(onFinish);
    });

    expect(addedMessages.map((m) => m.type)).toEqual(expect.arrayContaining(["brief"]));

    const brief = addedMessages.find((m) => m.type === "brief");
    await act(async () => {
      await brief?.payload.onContinue?.(createState(givenExperimentGroup, [SkillsRankingPhase.BRIEFING, SkillsRankingPhase.PROOF_OF_VALUE]));
    });
    expect(addedMessages.map((m) => m.type)).toContain("effort");

    const effort = addedMessages.find((m) => m.type === "effort");
    await act(async () => {
      await effort?.payload.onContinue?.(createState(givenExperimentGroup, [SkillsRankingPhase.PROOF_OF_VALUE, SkillsRankingPhase.JOB_SEEKER_DISCLOSURE]));
    });
    // Group 2 skips market; should go directly to jobseeker
    expect(addedMessages.map((m) => m.type)).toContain("jobseeker");

    const jobseeker = addedMessages.find((m) => m.type === "jobseeker");
    await act(async () => {
      await jobseeker?.payload.onContinue?.(createState(givenExperimentGroup, [SkillsRankingPhase.JOB_SEEKER_DISCLOSURE, SkillsRankingPhase.PERCEIVED_RANK]));
    });
    expect(addedMessages.map((m) => m.type)).toContain("perceived");

    const perceived = addedMessages.find((m) => m.type === "perceived");
    await act(async () => {
      await perceived?.payload.onContinue?.(createState(givenExperimentGroup, [SkillsRankingPhase.PERCEIVED_RANK, SkillsRankingPhase.COMPLETED]));
    });
    // Group 2 skips retyped and goes to completed/advice
    expect(addedMessages.map((m) => m.type)).toContain("advice");

    const advice = addedMessages.filter((m) => m.type === "advice").pop();
    await act(async () => {
      await advice?.payload.onDone?.(createState(givenExperimentGroup, [SkillsRankingPhase.COMPLETED]));
    });
    expect(onFinish).toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test("should initialize when no state exists and stop on invalid phase path", async () => {
    // GIVEN no existing state and invalid phase path
    const mockGetState = jest.fn().mockResolvedValue(null);
    const mockInit = jest.fn().mockResolvedValue(createState(SkillsRankingExperimentGroups.GROUP_2, [SkillsRankingPhase.INITIAL]));
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      getSkillsRankingState: mockGetState,
      updateSkillsRankingState: mockInit,
    } as unknown as SkillsRankingService);
    jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({ getActiveSessionId: () => 222 } as any);

    const addedMessages: Array<IChatMessage<MessagePayload>> = [];
    const addMessage = (addedMessage: IChatMessage<MessagePayload>) => addedMessages.push(addedMessage);
    const removeMessage = (_messageId: string) => {};
    const onFinish = jest.fn();

    // WHEN state has no phase yet (manipulate init state to have empty phases for path failure)
    const { result } = renderHook(() => useSkillsRanking(addMessage, removeMessage));
    await act(async () => {
      await result.current.showSkillsRanking(onFinish);
    });
    // Should have added the prompt from INITIAL via replay
    expect(addedMessages.map((addedMessage) => addedMessage.type)).toContain("prompt");
  });

  describe.each([
    { flowName: "full", group: SkillsRankingExperimentGroups.GROUP_1, path: skillsRankingHappyPathFull },
    { flowName: "skipped", group: SkillsRankingExperimentGroups.GROUP_2, path: skillsRankingHappyPathSkipped },
  ])("flow progression: $flowName", ({ group, path }) => {
    test.each(path.slice(0, -1).map((_, idx) => idx))(
      "should replay and continue correctly starting from phase index %s",
      async (startIndex: number) => {
        // GIVEN an existing state up to the starting phase in this flow
        const givenPhases = path.slice(0, startIndex + 1);
        const mockGetState = jest.fn().mockResolvedValue(createState(group, givenPhases));
        jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
          getSkillsRankingState: mockGetState,
          updateSkillsRankingState: jest.fn(),
        } as unknown as SkillsRankingService);
        jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({ getActiveSessionId: () => 999 } as any);

        const addedMessages: Array<IChatMessage<MessagePayload>> = [];
        const addMessage = (m: IChatMessage<MessagePayload>) => addedMessages.push(m);
        const removeMessage = (_messageId: string) => {};
        const onFinish = jest.fn();

        // WHEN showing skills ranking
        const { result } = renderHook(() => useSkillsRanking(addMessage, removeMessage));
        await act(async () => {
          await result.current.showSkillsRanking(onFinish);
        });

        // THEN expect the message for the last phase in the replayed state to be present
        const expectedReplayMessageTypeByPhase: Record<SkillsRankingPhase, string> = {
          [SkillsRankingPhase.INITIAL]: "prompt",
          [SkillsRankingPhase.BRIEFING]: "brief",
          [SkillsRankingPhase.PROOF_OF_VALUE]: "effort",
          [SkillsRankingPhase.DISCLOSURE]: "disclosure",
          [SkillsRankingPhase.MARKET_DISCLOSURE]: "market",
          [SkillsRankingPhase.JOB_SEEKER_DISCLOSURE]: "jobseeker",
          [SkillsRankingPhase.PERCEIVED_RANK]: "perceived",
          [SkillsRankingPhase.RETYPED_RANK]: "retyped",
          [SkillsRankingPhase.COMPLETED]: "advice",
        };
        const lastPhase = givenPhases[givenPhases.length - 1];
        expect(addedMessages.map((addedMessage) => addedMessage.type)).toContain(expectedReplayMessageTypeByPhase[lastPhase]);

        // AND when advancing via onContinue through the remaining phases, messages should be added accordingly
        const remainingPhases = path.slice(startIndex + 1);
        for (const phaseIndexOffset of remainingPhases.keys()) {
          const currentIndexInPath = startIndex + phaseIndexOffset;
          const currentPhase = path[currentIndexInPath];
          const nextPhase = path[currentIndexInPath + 1] ?? SkillsRankingPhase.COMPLETED;
          const currentMessageType = expectedReplayMessageTypeByPhase[currentPhase];
          const currentMessage = addedMessages.find((addedMessage) => addedMessage.type === currentMessageType);
          await advanceToNextPhase({ message: currentMessage, group, current: currentPhase, next: nextPhase });
        }

        // AND the final advice message triggers onDone and calls onFinish
        const advice = addedMessages.find((addedMessage) => addedMessage.type === "advice");
        if (advice) {
          await act(async () => {
            await advice.payload.onDone?.(createState(group, [SkillsRankingPhase.COMPLETED]));
          });
        }
        expect(onFinish).toHaveBeenCalled();
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      }
    );
  });
});


