// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import {
  createBriefingMessage,
  createDisclosureMessage,
  createPromptMessage,
  createPerceivedRankMessage,
  createEffortMessage,
  createPriorBeliefMessage,
  createPriorBeliefForSkillMessage,
  createProofOfValueIntroMessage,
  createApplicationMotivationMessage,
  createApplication24hMessage,
  createOpportunitySkillRequirementMessage,
  createPerceivedRankForSkillMessage,
} from "src/features/skillsRanking/utils/createMessages";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import SkillsRankingBriefing, {
  SKILLS_RANKING_BRIEFING_MESSAGE_ID,
} from "src/features/skillsRanking/components/skillsRankingBriefing/SkillsRankingBriefing";
import SkillsRankingDisclosure, {
  SKILLS_RANKING_DISCLOSURE_MESSAGE_ID,
} from "src/features/skillsRanking/components/skillsRankingDisclosure/SkillsRankingDisclosure";
import SkillsRankingPrompt, {
  SKILLS_RANKING_PROMPT_MESSAGE_ID,
} from "src/features/skillsRanking/components/skillsRankingPrompt/SkillsRankingPrompt";
import SkillsRankingPerceivedRank, {
  SKILLS_RANKING_PERCEIVED_RANK_MESSAGE_ID,
} from "src/features/skillsRanking/components/skillsRankingPerceivedRank/SkillsRankingPerceivedRank";
import SkillsRankingProofOfValue, {
  SKILLS_RANKING_EFFORT_MESSAGE_ID,
} from "src/features/skillsRanking/components/skillsRankingProofOfValue/SkillsRankingProofOfValue";
import SkillsRankingPriorBelief, {
  SKILLS_RANKING_PRIOR_BELIEF_MESSAGE_ID,
} from "src/features/skillsRanking/components/skillsRankingPriorBelief/SkillsRankingPriorBelief";
import SkillsRankingPriorBeliefForSkill, {
  SKILLS_RANKING_PRIOR_BELIEF_FOR_SKIll_MESSAGE_ID,
} from "src/features/skillsRanking/components/skillsRankingPriorBeliefForSkill/SkillsRankingPriorBeliefForSkill";
import ProofOfValueIntro, {
  PROOF_OF_VALUE_INTRO_MESSAGE_ID,
} from "src/features/skillsRanking/components/skillsRankingProofOfValueIntro/SkillsRankingProofOfValueIntro";
import SkillsRankingApplicationMotivation from "src/features/skillsRanking/components/skillsRankingApplicationMotivation/SkillsRankingApplicationMotivation";
import SkillsRankingApplication24h from "src/features/skillsRanking/components/skillsRankingApplication24h/SkillsRankingApplication24h";
import SkillsRankingOpportunitySkillRequirement, {
  SKILLS_RANKING_OPPORTUNITY_SKILL_REQUIREMENT_MESSAGE_ID,
} from "src/features/skillsRanking/components/skillsRankingOpportunitySkillRequirement/SkillsRankingOpportunitySkillRequirement";
import SkillsRankingPerceivedRankForSkill, {
  SKILLS_RANKING_PERCEIVED_RANK_FOR_SKILL_MESSAGE_ID,
} from "src/features/skillsRanking/components/skillsRankingPerceivedRankForSkill/SkillsRankingPerceivedRankForSkill";
import {
  SkillsRankingPhase,
  SkillsRankingExperimentGroups,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import * as flowGraph from "src/features/skillsRanking/hooks/skillsRankingFlowGraph";

describe("createMessages", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create a SkillsRankingState with defaults
  const createState = (
    phase: SkillsRankingPhase,
    group: SkillsRankingExperimentGroups = SkillsRankingExperimentGroups.GROUP_1,
    overrides: Partial<SkillsRankingState> = {}
  ): SkillsRankingState => ({
    session_id: overrides.session_id ?? 1234,
    metadata: {
      started_at: overrides.metadata?.started_at ?? "2024-01-01T00:00:00Z",
      experiment_group: group,
    },
    // @ts-ignore
    phase: overrides.phase ?? [{ name: phase, time: overrides.phase?.[0]?.time ?? "2024-01-01T00:10:00Z" }],
    score: overrides.score ?? {
      above_average_labels: [],
      below_average_labels: [],
      most_demanded_label: "Data Analysis",
      most_demanded_percent: 0,
      least_demanded_label: "Least",
      least_demanded_percent: 0,
      average_percent_for_jobseeker_skill_groups: 0,
      average_count_for_jobseeker_skill_groups: 0,
      province_used: "X",
      matched_skill_groups: 0,
      calculated_at: "2024-01-01T00:00:00Z",
    },
    user_responses: overrides.user_responses ?? {},
  });

  describe("createBriefingMessage", () => {
    test("should return a briefing chat message with expected payload and component", () => {
      // GIVEN a skillsRankingState
      const skillsRankingState: any = { metadata: { started_at: new Date().toISOString() } };
      // AND an onFinish mock function
      const onFinish = jest.fn();

      // WHEN calling createBriefingMessage
      const briefingMessage = createBriefingMessage(skillsRankingState, onFinish);

      // THEN expect the message to have the correct structure
      expect(briefingMessage).toMatchObject({
        message_id: SKILLS_RANKING_BRIEFING_MESSAGE_ID,
        type: SKILLS_RANKING_BRIEFING_MESSAGE_ID,
        sender: ConversationMessageSender.COMPASS,
        payload: { skillsRankingState, onFinish },
      });
      // AND the component should be a valid React element
      const element = briefingMessage.component(briefingMessage.payload);
      expect(React.isValidElement(element)).toBe(true);
      expect((element as any).type).toBe(SkillsRankingBriefing);
      expect((element as any).props).toMatchObject({ skillsRankingState, onFinish });
    });
  });

  describe("createDisclosureMessage", () => {
    test("should return a disclosure chat message with expected payload and component", () => {
      // GIVEN a skillsRankingState
      const skillsRankingState: any = { metadata: { started_at: new Date().toISOString() } };
      // AND an onFinish mock function
      const onFinish = jest.fn();

      // WHEN calling createDisclosureMessage
      const disclosureMessage = createDisclosureMessage(skillsRankingState, onFinish);

      // THEN expect the message to have the correct structure
      expect(disclosureMessage).toMatchObject({
        message_id: SKILLS_RANKING_DISCLOSURE_MESSAGE_ID,
        type: SKILLS_RANKING_DISCLOSURE_MESSAGE_ID,
        sender: ConversationMessageSender.COMPASS,
        payload: { skillsRankingState, onFinish },
      });
      // AND the component should be a valid React element
      const element = disclosureMessage.component(disclosureMessage.payload);
      expect(React.isValidElement(element)).toBe(true);
      expect((element as any).type).toBe(SkillsRankingDisclosure);
      expect((element as any).props).toMatchObject({ skillsRankingState, onFinish });
    });
  });

  describe("createPromptMessage", () => {
    test("should return a prompt chat message with expected payload and component", () => {
      // GIVEN a skillsRankingState
      const skillsRankingState: any = { metadata: { started_at: new Date().toISOString() } };
      // AND an onFinish mock function
      const onFinish = jest.fn();

      // WHEN calling createPromptMessage
      const promptMessage = createPromptMessage(skillsRankingState, onFinish);

      // THEN expect the message to have the correct structure
      expect(promptMessage).toMatchObject({
        message_id: SKILLS_RANKING_PROMPT_MESSAGE_ID,
        type: SKILLS_RANKING_PROMPT_MESSAGE_ID,
        sender: ConversationMessageSender.COMPASS,
        payload: { skillsRankingState, onFinish },
      });
      // AND the component should be a valid React element
      const element = promptMessage.component(promptMessage.payload);
      expect(React.isValidElement(element)).toBe(true);
      expect((element as any).type).toBe(SkillsRankingPrompt);
      expect((element as any).props).toMatchObject({ skillsRankingState, onFinish });
    });
  });

  describe("createPerceivedRankMessage", () => {
    test("should create perceived rank message and submit moving to the next phase", async () => {
      // GIVEN state at PERCEIVED_RANK with active session id
      const skillsRankingState = createState(SkillsRankingPhase.PERCEIVED_RANK, SkillsRankingExperimentGroups.GROUP_1, {
        user_responses: { perceived_rank_percentile: 55 },
      });
      const onFinish = jest.fn().mockResolvedValue(undefined);
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
      const sessionId = 4321;
      jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({
        getActiveSessionId: () => sessionId,
      } as any);
      const nextPhaseSpy = jest
        .spyOn(flowGraph, "getNextPhaseForGroup")
        .mockReturnValue(SkillsRankingPhase.PERCEIVED_RANK_FOR_SKILL);

      // WHEN creating the message
      const message = createPerceivedRankMessage(skillsRankingState, onFinish);

      // THEN payload and component correct
      expect(message).toMatchObject({
        message_id: SKILLS_RANKING_PERCEIVED_RANK_MESSAGE_ID,
        type: SKILLS_RANKING_PERCEIVED_RANK_MESSAGE_ID,
        sender: ConversationMessageSender.COMPASS,
      });
      expect(message.payload).toMatchObject({
        isReadOnly: false,
        mostDemandedLabel: "Data Analysis",
        sentAt: skillsRankingState.phase[0].time,
        defaultValue: 55,
      });
      const element = message.component(message.payload);
      expect(React.isValidElement(element)).toBe(true);
      expect((element as any).type).toBe(SkillsRankingPerceivedRank);

      // WHEN submitting a new value
      await message.payload.onSubmit(70);

      // THEN expect updateSkillsRankingState called and onFinish called
      expect(mockUpdate).toHaveBeenCalledWith(sessionId, SkillsRankingPhase.PERCEIVED_RANK_FOR_SKILL, {
        perceived_rank_percentile: 70,
      });
      expect(onFinish).toHaveBeenCalled();
      nextPhaseSpy.mockRestore();
    });

    test("should log error and not update when active session id is missing", async () => {
      // GIVEN state at PERCEIVED_RANK without a session id
      const skillsRankingState = createState(SkillsRankingPhase.PERCEIVED_RANK, SkillsRankingExperimentGroups.GROUP_2, {
        user_responses: { perceived_rank_percentile: 20 },
      });
      const onFinish = jest.fn();
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
      jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({
        getActiveSessionId: () => null,
      } as any);

      // WHEN creating and submitting
      const message = createPerceivedRankMessage(skillsRankingState, onFinish);
      await message.payload.onSubmit(40);

      // THEN no update, no finish, error logged
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(onFinish).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("createEffortMessage", () => {
    test("should return an effort chat message with expected payload and component", () => {
      // GIVEN a skillsRankingState
      const skillsRankingState: any = { metadata: { started_at: new Date().toISOString() } };
      // AND an onFinish mock function
      const onFinish = jest.fn();

      // WHEN calling createEffortMessage
      const effortMessage = createEffortMessage(skillsRankingState, onFinish);

      // THEN expect the message to have the correct structure
      expect(effortMessage).toMatchObject({
        message_id: SKILLS_RANKING_EFFORT_MESSAGE_ID,
        type: SKILLS_RANKING_EFFORT_MESSAGE_ID,
        sender: ConversationMessageSender.COMPASS,
        payload: { skillsRankingState, onFinish },
      });
      // AND the component should be a valid React element
      const element = effortMessage.component(effortMessage.payload);
      expect(React.isValidElement(element)).toBe(true);
      expect((element as any).type).toBe(SkillsRankingProofOfValue);
      expect((element as any).props).toMatchObject({ skillsRankingState, onFinish });
    });
  });

  describe("createPriorBeliefMessage", () => {
    test("should return a prior belief chat message with expected payload and component", () => {
      // GIVEN a skillsRankingState
      const skillsRankingState: any = { metadata: { started_at: new Date().toISOString() } };
      // AND an onFinish mock function
      const onFinish = jest.fn();

      // WHEN calling createPriorBeliefMessage
      const priorBeliefMessage = createPriorBeliefMessage(skillsRankingState, onFinish);

      // THEN expect the message to have the correct structure
      expect(priorBeliefMessage).toMatchObject({
        message_id: SKILLS_RANKING_PRIOR_BELIEF_MESSAGE_ID,
        type: SKILLS_RANKING_PRIOR_BELIEF_MESSAGE_ID,
        sender: ConversationMessageSender.COMPASS,
        payload: { skillsRankingState, onFinish },
      });
      // AND the component should be a valid React element
      const element = priorBeliefMessage.component(priorBeliefMessage.payload);
      expect(React.isValidElement(element)).toBe(true);
      expect((element as any).type).toBe(SkillsRankingPriorBelief);
      expect((element as any).props).toMatchObject({ skillsRankingState, onFinish });
    });
  });

  describe("createPriorBeliefForSkillMessage", () => {
    test("should return a prior belief for skill chat message with expected payload and component", () => {
      // GIVEN a skillsRankingState
      const skillsRankingState: any = { metadata: { started_at: new Date().toISOString() } };
      // AND an onFinish mock function
      const onFinish = jest.fn();

      // WHEN calling createPriorBeliefForSkillMessage
      const priorBeliefForSkillMessage = createPriorBeliefForSkillMessage(skillsRankingState, onFinish);

      // THEN expect the message to have the correct structure
      expect(priorBeliefForSkillMessage).toMatchObject({
        message_id: SKILLS_RANKING_PRIOR_BELIEF_FOR_SKIll_MESSAGE_ID,
        type: SKILLS_RANKING_PRIOR_BELIEF_FOR_SKIll_MESSAGE_ID,
        sender: ConversationMessageSender.COMPASS,
        payload: { skillsRankingState, onFinish },
      });
      // AND the component should be a valid React element
      const element = priorBeliefForSkillMessage.component(priorBeliefForSkillMessage.payload);
      expect(React.isValidElement(element)).toBe(true);
      expect((element as any).type).toBe(SkillsRankingPriorBeliefForSkill);
      expect((element as any).props).toMatchObject({ skillsRankingState, onFinish });
    });
  });

  describe("createProofOfValueIntroMessage", () => {
    test("should return a proof of value intro chat message with expected payload and component", () => {
      // GIVEN a skillsRankingState
      const skillsRankingState: any = { metadata: { started_at: new Date().toISOString() } };
      // AND an onFinish mock function
      const onFinish = jest.fn();

      // WHEN calling createProofOfValueIntroMessage
      const povIntroMessage = createProofOfValueIntroMessage(skillsRankingState, onFinish);

      // THEN expect the message to have the correct structure
      expect(povIntroMessage).toMatchObject({
        message_id: PROOF_OF_VALUE_INTRO_MESSAGE_ID,
        type: PROOF_OF_VALUE_INTRO_MESSAGE_ID,
        sender: ConversationMessageSender.COMPASS,
        payload: { skillsRankingState, onFinish },
      });
      // AND the component should be a valid React element
      const element = povIntroMessage.component(povIntroMessage.payload);
      expect(React.isValidElement(element)).toBe(true);
      expect((element as any).type).toBe(ProofOfValueIntro);
      expect((element as any).props).toMatchObject({ skillsRankingState, onFinish });
    });
  });

  describe("createApplicationMotivationMessage", () => {
    test("should create application motivation message and submit moving to the next phase", async () => {
      // GIVEN APPLICATION_WILLINGNESS phase with active session id
      const skillsRankingState = createState(
        SkillsRankingPhase.APPLICATION_WILLINGNESS,
        SkillsRankingExperimentGroups.GROUP_1
      );
      const onFinish = jest.fn().mockResolvedValue(undefined);
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
      const sessionId = 4322;
      jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({
        getActiveSessionId: () => sessionId,
      } as any);
      const nextPhaseSpy = jest
        .spyOn(flowGraph, "getNextPhaseForGroup")
        .mockReturnValue(SkillsRankingPhase.APPLICATION_24H);

      // WHEN creating the message
      const message = createApplicationMotivationMessage(skillsRankingState, onFinish);

      // THEN basic structure and component
      expect(message).toMatchObject({
        message_id: "skills-ranking-application-motivation-message",
        type: "skills-ranking-application-motivation-message",
        sender: ConversationMessageSender.COMPASS,
      });
      const element = message.component(message.payload);
      expect(React.isValidElement(element)).toBe(true);
      expect((element as any).type).toBe(SkillsRankingApplicationMotivation);

      // WHEN invoking onFinish with user response
      const stateWithResponse: SkillsRankingState = {
        ...skillsRankingState,
        user_responses: { application_willingness: { value: 85, label: "85%" } },
      };
      await message.payload.onFinish(stateWithResponse);

      // THEN update called with next phase and response; onFinish called
      expect(mockUpdate).toHaveBeenCalledWith(sessionId, SkillsRankingPhase.APPLICATION_24H, {
        application_willingness: { value: 85, label: "85%" },
      });
      expect(onFinish).toHaveBeenCalled();
      nextPhaseSpy.mockRestore();
    });

    test("should log error and not update when active session id is missing", async () => {
      // GIVEN APPLICATION_WILLINGNESS phase without session id
      const skillsRankingState = createState(
        SkillsRankingPhase.APPLICATION_WILLINGNESS,
        SkillsRankingExperimentGroups.GROUP_2
      );
      const onFinish = jest.fn();
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
      jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({
        getActiveSessionId: () => null,
      } as any);
      jest.spyOn(flowGraph, "getNextPhaseForGroup").mockReturnValue(SkillsRankingPhase.APPLICATION_24H);

      // WHEN creating and finishing
      const message = createApplicationMotivationMessage(skillsRankingState, onFinish);
      await message.payload.onFinish({
        ...skillsRankingState,
        user_responses: { application_willingness: { value: 50, label: "50%" } },
      });

      // THEN no update, no finish, error logged
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(onFinish).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("createApplication24hMessage", () => {
    test("should create application 24h message and submit moving to the next phase", async () => {
      // GIVEN APPLICATION_24H phase with active session id
      const skillsRankingState = createState(SkillsRankingPhase.APPLICATION_24H, SkillsRankingExperimentGroups.GROUP_2);
      const onFinish = jest.fn().mockResolvedValue(undefined);
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
      const sessionId = 2468;
      jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({
        getActiveSessionId: () => sessionId,
      } as any);
      const nextPhaseSpy = jest
        .spyOn(flowGraph, "getNextPhaseForGroup")
        .mockReturnValue(SkillsRankingPhase.OPPORTUNITY_SKILL_REQUIREMENT);

      // WHEN creating the message
      const message = createApplication24hMessage(skillsRankingState, onFinish);

      // THEN basic structure and component
      expect(message).toMatchObject({
        message_id: "skills-ranking-application-24h-message",
        type: "skills-ranking-application-24h-message",
        sender: ConversationMessageSender.COMPASS,
      });
      const element = message.component(message.payload);
      expect(React.isValidElement(element)).toBe(true);
      expect((element as any).type).toBe(SkillsRankingApplication24h);

      // WHEN invoking onFinish with user response
      const stateWithResponse: SkillsRankingState = {
        ...skillsRankingState,
        user_responses: { application_24h: 1 },
      };
      await message.payload.onFinish(stateWithResponse);

      // THEN update called and onFinish called
      expect(mockUpdate).toHaveBeenCalledWith(sessionId, SkillsRankingPhase.OPPORTUNITY_SKILL_REQUIREMENT, {
        application_24h: 1,
      });
      expect(onFinish).toHaveBeenCalled();
      nextPhaseSpy.mockRestore();
    });

    test("should log error and not update when active session id is missing", async () => {
      // GIVEN APPLICATION_24H phase without session id
      const skillsRankingState = createState(SkillsRankingPhase.APPLICATION_24H, SkillsRankingExperimentGroups.GROUP_3);
      const onFinish = jest.fn();
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
      jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({
        getActiveSessionId: () => null,
      } as any);
      jest.spyOn(flowGraph, "getNextPhaseForGroup").mockReturnValue(SkillsRankingPhase.OPPORTUNITY_SKILL_REQUIREMENT);

      // WHEN creating and finishing
      const message = createApplication24hMessage(skillsRankingState, onFinish);
      await message.payload.onFinish({
        ...skillsRankingState,
        user_responses: { application_24h: 0 },
      });

      // THEN no update, no finish, error logged
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(onFinish).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("createOpportunitySkillRequirementMessage", () => {
    test("should create opportunity skill requirement message and submit moving to the next phase", async () => {
      // GIVEN OPPORTUNITY_SKILL_REQUIREMENT phase with active session id
      const skillsRankingState = createState(
        SkillsRankingPhase.OPPORTUNITY_SKILL_REQUIREMENT,
        SkillsRankingExperimentGroups.GROUP_1,
        { user_responses: { opportunity_skill_requirement_percentile: 40 } }
      );
      const onFinish = jest.fn().mockResolvedValue(undefined);
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
      const sessionId = 2345;
      jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({
        getActiveSessionId: () => sessionId,
      } as any);
      const nextPhaseSpy = jest.spyOn(flowGraph, "getNextPhaseForGroup").mockReturnValue(SkillsRankingPhase.COMPLETED);

      // WHEN creating the message
      const message = createOpportunitySkillRequirementMessage(skillsRankingState, onFinish);

      // THEN payload and component correct
      expect(message).toMatchObject({
        message_id: SKILLS_RANKING_OPPORTUNITY_SKILL_REQUIREMENT_MESSAGE_ID,
        type: SKILLS_RANKING_OPPORTUNITY_SKILL_REQUIREMENT_MESSAGE_ID,
        sender: ConversationMessageSender.COMPASS,
      });
      expect(message.payload).toMatchObject({
        isReadOnly: false,
        mostDemandedLabel: skillsRankingState.score.most_demanded_label,
        sentAt: skillsRankingState.phase[0].time,
        defaultValue: 40,
      });
      const element = message.component(message.payload);
      expect(React.isValidElement(element)).toBe(true);
      expect((element as any).type).toBe(SkillsRankingOpportunitySkillRequirement);

      // WHEN submitting a new value
      await message.payload.onSubmit(55);

      // THEN update called and onFinish called
      expect(mockUpdate).toHaveBeenCalledWith(sessionId, SkillsRankingPhase.COMPLETED, {
        opportunity_skill_requirement: 55,
      });
      expect(onFinish).toHaveBeenCalled();
      nextPhaseSpy.mockRestore();
    });

    test("should log error and not update when active session id is missing", async () => {
      // GIVEN OPPORTUNITY_SKILL_REQUIREMENT phase without session id
      const skillsRankingState = createState(
        SkillsRankingPhase.OPPORTUNITY_SKILL_REQUIREMENT,
        SkillsRankingExperimentGroups.GROUP_2,
        { user_responses: { opportunity_skill_requirement_percentile: 10 } }
      );
      const onFinish = jest.fn();
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
      jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({
        getActiveSessionId: () => null,
      } as any);
      jest.spyOn(flowGraph, "getNextPhaseForGroup").mockReturnValue(SkillsRankingPhase.COMPLETED);

      // WHEN creating and submitting
      const message = createOpportunitySkillRequirementMessage(skillsRankingState, onFinish);
      await message.payload.onSubmit(25);

      // THEN no update, no finish, error logged
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(onFinish).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("createPerceivedRankForSkillMessage", () => {
    test("should create perceived rank for skill message and submit moving to the next phase", async () => {
      // GIVEN PERCEIVED_RANK_FOR_SKILL phase with active session id
      const skillsRankingState = createState(
        SkillsRankingPhase.PERCEIVED_RANK_FOR_SKILL,
        SkillsRankingExperimentGroups.GROUP_1,
        { user_responses: { perceived_rank_for_skill_percentile: 25 } }
      );
      const onFinish = jest.fn().mockResolvedValue(undefined);
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
      const sessionId = 5678;
      jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({
        getActiveSessionId: () => sessionId,
      } as any);
      const nextPhaseSpy = jest.spyOn(flowGraph, "getNextPhaseForGroup").mockReturnValue(SkillsRankingPhase.COMPLETED);

      // WHEN creating the message
      const message = createPerceivedRankForSkillMessage(skillsRankingState, onFinish);

      // THEN payload and component correct
      expect(message).toMatchObject({
        message_id: SKILLS_RANKING_PERCEIVED_RANK_FOR_SKILL_MESSAGE_ID,
        type: SKILLS_RANKING_PERCEIVED_RANK_FOR_SKILL_MESSAGE_ID,
        sender: ConversationMessageSender.COMPASS,
      });
      expect(message.payload).toMatchObject({
        isReadOnly: false,
        leastDemandedLabel: skillsRankingState.score.least_demanded_label,
        sentAt: skillsRankingState.phase[0].time,
        defaultValue: 25,
      });
      const element = message.component(message.payload);
      expect(React.isValidElement(element)).toBe(true);
      expect((element as any).type).toBe(SkillsRankingPerceivedRankForSkill);

      // WHEN submitting a new value
      await message.payload.onSubmit(35);

      // THEN update called and onFinish called
      expect(mockUpdate).toHaveBeenCalledWith(sessionId, SkillsRankingPhase.COMPLETED, {
        perceived_rank_for_skill: 35,
      });
      expect(onFinish).toHaveBeenCalled();
      nextPhaseSpy.mockRestore();
    });

    test("should log error and not update when active session id is missing", async () => {
      // GIVEN PERCEIVED_RANK_FOR_SKILL phase without a session id
      const skillsRankingState = createState(
        SkillsRankingPhase.PERCEIVED_RANK_FOR_SKILL,
        SkillsRankingExperimentGroups.GROUP_3,
        { user_responses: { perceived_rank_for_skill_percentile: 10 } }
      );
      const onFinish = jest.fn();
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
      jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({
        getActiveSessionId: () => null,
      } as any);
      const nextPhaseSpy = jest.spyOn(flowGraph, "getNextPhaseForGroup").mockReturnValue(SkillsRankingPhase.COMPLETED);

      // WHEN creating and submitting
      const message = createPerceivedRankForSkillMessage(skillsRankingState, onFinish);
      await message.payload.onSubmit(20);

      // THEN no update, no finish, error logged
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(onFinish).not.toHaveBeenCalled();
      nextPhaseSpy.mockRestore();
    });
  });
});
