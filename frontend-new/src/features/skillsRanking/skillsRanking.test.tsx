// mute the console
import "src/_test_utilities/consoleMock";

import { useEffect, useState } from "react";

import ChatList from "src/chat/chatList/ChatList";
import { IChatMessage } from "src/chat/Chat.types";
import { useSkillsRanking } from "./hooks/useSkillsRanking";
import { cleanup, render, renderHook, screen, userEvent, waitFor } from "src/_test_utilities/test-utils";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { UserPreference } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { SkillsRankingExperimentGroups, SkillsRankingMetrics, SkillsRankingPhase, SkillsRankingState } from "./types";
import { getFlowPathForGroup } from "./hooks/skillsRankingFlowGraph";

import { DATA_TEST_ID as BRIEFING_DATA_TEST_ID } from "./components/skillsRankingBriefing/SkillsRankingBriefing";
import {
  DATA_TEST_ID as PROOF_OF_VALUE_INTRO_DATA_TEST_ID,
} from "./components/skillsRankingProofOfValueIntro/SkillsRankingProofOfValueIntro";
import { DATA_TEST_ID as PROOF_OF_VALUE_DATA_TEST_ID } from "./components/rotateToSolve/RotateToSolvePuzzle";
import {
  DATA_TEST_ID as PRIOR_BELIEF_DATA_TEST_ID,
} from "./components/skillsRankingPriorBelief/SkillsRankingPriorBelief";
import {
  DATA_TEST_ID as PRIOR_BELIEF_FOR_SKILL_DATA_TEST_ID,
} from "./components/skillsRankingPriorBeliefForSkill/SkillsRankingPriorBeliefForSkill";
import { DATA_TEST_ID as DISCLOSURE_DATA_TEST_ID } from "./components/skillsRankingDisclosure/SkillsRankingDisclosure";
import {
  DATA_TEST_ID as APPLICATION_MOTIVATION_DATA_TEST_ID,
} from "./components/skillsRankingApplicationMotivation/SkillsRankingApplicationMotivation";
import {
  DATA_TEST_ID as APPLICATION_24H_DATA_TEST_ID,
} from "./components/skillsRankingApplication24h/SkillsRankingApplication24h";
import {
  DATA_TEST_ID as PERCEIVED_RANK_DATA_TEST_ID,
} from "./components/skillsRankingPerceivedRank/SkillsRankingPerceivedRank";
import {
  DATA_TEST_ID as PERCEIVED_RANK_FOR_SKILL_DATA_TEST_ID,
} from "./components/skillsRankingPerceivedRankForSkill/SkillsRankingPerceivedRankForSkill";
import {
  DATA_TEST_ID as OPPORTUNITY_SKILL_REQUIREMENT_DATA_TEST_ID,
} from "./components/skillsRankingOpportunitySkillRequirement/SkillsRankingOpportunitySkillRequirement";

jest.mock("src/features/skillsRanking/constants", () => ({
  ...jest.requireActual("src/features/skillsRanking/constants"),
  MESSAGE_DURATION_MS: () => 0,
}));

type CreateStateFn = (group: SkillsRankingExperimentGroups, phases: SkillsRankingPhase[]) => SkillsRankingState;
const createFreshState: CreateStateFn = (group, phases) => {
  return {
    session_id: 1,
    phase: phases.map((name) => ({ name, time: new Date().toISOString() })),
    score: {
      above_average_labels: [],
      below_average_labels: [],
      most_demanded_label: "",
      most_demanded_percent: 0,
      least_demanded_label: "",
      least_demanded_percent: 0,
      average_percent_for_jobseeker_skill_groups: 0,
      average_count_for_jobseeker_skill_groups: 0,
      province_used: "",
      matched_skill_groups: 0,
      calculated_at: new Date().toISOString(),
    },
    metadata: {
      experiment_group: group,
      started_at: new Date().toISOString(),
    },
    user_responses: {
      prior_belief_percentile: 1,
      prior_belief_for_skill_percentile: 1,
      perceived_rank_percentile: 1,
      perceived_rank_for_skill_percentile: 1,
      application_willingness: {
        value: 1,
        label: "application-willingness-label",
      },
      application_24h: 1,
      opportunity_skill_requirement_percentile: 1,
    },
  };
};

const createCompleteState: CreateStateFn = (group, phases): SkillsRankingState => {
  let freshState = createFreshState(group, phases);

  freshState.score = {
    above_average_labels: ["most-demanded-label", "above-average-label-1", "above-average-label-2"],
    below_average_labels: ["least-demanded-label", "below-average-label-1", "below-average-label-2"],
    most_demanded_label: "most-demanded-label",
    most_demanded_percent: 75,
    least_demanded_label: "least-demanded-label",
    least_demanded_percent: 10,
    average_percent_for_jobseeker_skill_groups: 40,
    average_count_for_jobseeker_skill_groups: 50,
    province_used: "GIVEN_PROVINCE_USED",
    matched_skill_groups: 0,
    calculated_at: new Date().toISOString(),
  };

  freshState.user_responses = {
    prior_belief_percentile: 33,
    prior_belief_for_skill_percentile: 31,
    perceived_rank_percentile: 45,
    perceived_rank_for_skill_percentile: 71,
    application_willingness: {
      value: 10,
      label: "application-willingness-label",
    },
    application_24h: 1,
    opportunity_skill_requirement_percentile: 45,
  };

  return freshState;
};

/**
 * Fake SkillsRankingService.updateSkillsRankingState.
 *
 * It is used to mock the backend call.
 * It just update the state with the information provided and returns a new state in memory.
 */
type Options = {
  perceived_rank_percentile?: number;
  perceived_rank_for_skill?: number;
  prior_belief?: number;
  prior_belief_for_skill?: number;
  application_willingness?: { value: number; label: string };
  application_24h?: number;
  opportunity_skill_requirement?: number;
};

function fakeUpdateState(initialState: SkillsRankingState) {
  let actualState = initialState;
  return async function (
    sessionId: number,
    phase: SkillsRankingPhase,
    options?: Options,
    metrics?: SkillsRankingMetrics
  ): Promise<SkillsRankingState> {
    if (sessionId !== initialState.session_id) {
      throw new Error("Invalid session id");
    }

    if (phase === SkillsRankingPhase.INITIAL) {
      return initialState;
    }

    actualState.phase = [
      ...actualState.phase,
      {
        name: phase,
        time: new Date().toString(),
      },
    ];

    actualState = {
      ...actualState,
      metadata: {
        ...initialState.metadata,
        ...(metrics || {}),
      },
      user_responses: {
        ...initialState.user_responses,
        ...(options || {}),
      },
    };

    return actualState;
  };
}

async function clickButton(buttonTestId: string) {
  await waitFor(
    async () => {
      const button = screen.getByTestId(buttonTestId);
      await userEvent.click(button);
    }
  );
}

const skillsRankingFeatureConfig = {
  enabled: true,
  config: {
    compensationAmount: "0",
    jobPlatformUrl: "Test Platform",
    shortTypingDurationMs: 0,
    defaultTypingDurationMs: 0,
    longTypingDurationMs: 0,
  },
};

const FakeChatList = ({ onFinishCallback }: { onFinishCallback: () => void }) => {
  const [messages, setMessages] = useState<IChatMessage<any>[]>([]);
  const addMessage = (message: IChatMessage<any>) => {
    const current = [...messages];
    if (!messages.find((m) => m.message_id === message.message_id)) {
      current.push(message);
      setMessages(current);
    } else {
      setMessages(current);
    }
  };

  const { showSkillsRanking } = useSkillsRanking(addMessage, jest.fn());
  useEffect(() => {
    showSkillsRanking(onFinishCallback).then();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <ChatList messages={messages} />;
};

describe("Skills Ranking Integration", () => {
  beforeAll(() => {
    UserPreferencesStateService.getInstance().setUserPreferences({
      sessions: [1],
    } as UserPreference);
  });

  beforeEach(() => {
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.resetAllMocks();
    cleanup();
  });

  describe("Feature unusable tests", () => {
    test("should finish the feature if initializing fails", async () => {
      // GIVEN the feature initializing will fail,
      jest
        .spyOn(SkillsRankingService.getInstance(), "updateSkillsRankingState")
        .mockRejectedValue(new Error("Service Error"));

      // WHEN triggering the skill ranking feature flow.
      const addMessage = jest.fn();
      const onFinishCallback = jest.fn();

      const { result } = renderHook(() => useSkillsRanking(addMessage, jest.fn()));
      await result.current.showSkillsRanking(onFinishCallback);

      // THEN it should log an error
      expect(console.error).toHaveBeenCalled();

      // AND should call the onFinish callback.
      expect(onFinishCallback).toHaveBeenCalled();
    });

    test("should finish the feature, if the state contains an invalid experiment group. [Unexpected]", async () => {
      // GIVEN state in the backend with an unknown experiment group.
      const givenGroup = "some-unknown-group" as SkillsRankingExperimentGroups;
      const state = createCompleteState(givenGroup, []);
      jest.spyOn(SkillsRankingService.getInstance(), "getSkillsRankingState").mockResolvedValue(state);

      // WHEN the component is rendered.
      const onFinishCallback = jest.fn();
      const { result } = renderHook(() => useSkillsRanking(jest.fn(), jest.fn()));
      await result.current.showSkillsRanking(onFinishCallback);

      // THEN the feature should finish.
      expect(onFinishCallback).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("Should finish an already complicated state", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test.each([
      SkillsRankingExperimentGroups.GROUP_1,
      SkillsRankingExperimentGroups.GROUP_2,
      SkillsRankingExperimentGroups.GROUP_3,
    ])(
      "should automatically complete the feature if the state is already completed for group %s",
      async (givenGroup) => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2024-01-01T00:00:00Z"));

        // GIVEN that the backend contains an already completed state.
        const allPhases = getFlowPathForGroup(givenGroup);
        const state = createCompleteState(givenGroup, allPhases);
        jest.spyOn(SkillsRankingService.getInstance(), "getSkillsRankingState").mockResolvedValue(state);

        // WHEN rendering the skill ranking feature.
        const addMessage = jest.fn();
        const onFinishCallback = jest.fn();
        const { result } = renderHook(() => useSkillsRanking(addMessage, jest.fn()));
        await result.current.showSkillsRanking(onFinishCallback);

        // THEN the feature should finish automatically.
        expect(onFinishCallback).toHaveBeenCalled();

        // AND addMessage should be called with the correct message.
        //     Note: -1 means that the COMPLETED phase does not add a message.
        //           It is just a phase.
        expect(addMessage).toHaveBeenCalledTimes(allPhases.length - 1);

        // AND no errors/warnings should be logged.
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();

        // AND the calls should match the snapshot.
        expect(addMessage.mock.calls).toMatchSnapshot();
      }
    );
  });

  describe("Integration", () => {
    test("should trigger the correct flow for group 1 from start to finish", async () => {
      // On JSDOM (Window.scrollTo is not implemented).
      jest.spyOn(window, "scrollTo").mockImplementation(jest.fn());

      // AND an initial state for group 1.
      const givenState = null;

      // AND get state will return the given state.
      jest.spyOn(SkillsRankingService.getInstance(), "getSkillsRankingState").mockResolvedValue(givenState);

      // AND initialize will return a fresh initialized state
      const initialState = createFreshState(SkillsRankingExperimentGroups.GROUP_1, [SkillsRankingPhase.INITIAL]);
      jest
        .spyOn(SkillsRankingService.getInstance(), "updateSkillsRankingState")
        .mockImplementation(fakeUpdateState(initialState));
      jest.spyOn(SkillsRankingService.getInstance(), "getConfig").mockReturnValue(skillsRankingFeatureConfig);

      // WHEN it is rendered into the content.
      const onFinishCallback = jest.fn();

      render(<FakeChatList onFinishCallback={onFinishCallback} />);

      // AND I click on the `continue` button on the briefing component.
      await clickButton(BRIEFING_DATA_TEST_ID.SKILLS_RANKING_BRIEFING_CONTINUE_BUTTON);

      // AND I click `continue` on the Proof of value intro.
      await clickButton(PROOF_OF_VALUE_INTRO_DATA_TEST_ID.PROOF_OF_VALUE_INTRO_CONTINUE_BUTTON);

      // AND I click on the `cancel` on the proof of value component.
      await clickButton(PROOF_OF_VALUE_DATA_TEST_ID.CANCEL_BUTTON);

      // AND submit prior belief.
      //     1. Set the value.
      //        TODO: Find a way to drag an item.
      //     2. Click submit.
      await clickButton(PRIOR_BELIEF_DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_SUBMIT_BUTTON);

      // AND I submit the prior belief for skill.
      //     1. Set the value.
      //        TODO: Find a way to drag an item.
      //     2. Click submit.
      await clickButton(PRIOR_BELIEF_FOR_SKILL_DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_FOR_SKILL_SUBMIT_BUTTON);

      // AND I submit the prior belief for the opportunity skill requirement.
      await clickButton(
        OPPORTUNITY_SKILL_REQUIREMENT_DATA_TEST_ID.SKILLS_RANKING_OPPORTUNITY_SKILL_REQUIREMENT_SUBMIT_BUTTON
      );

      // AND I click on the disclosure component continue button.
      await clickButton(DISCLOSURE_DATA_TEST_ID.SKILLS_RANKING_DISCLOSURE_CONTINUE_BUTTON);

      // THEN the conversation should be finished.
      expect(onFinishCallback).toHaveBeenCalled();

      // AND no errors/warnings should be logged.
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test.each([SkillsRankingExperimentGroups.GROUP_2, SkillsRankingExperimentGroups.GROUP_3])(
      "should trigger the correct flow for group %s up to finish",
      async (givenGroup) => {
        // On JSDOM (Window.scrollTo is not implemented).
        jest.spyOn(window, "scrollTo").mockImplementation(jest.fn());

        // AND an initial state for group 1.
        const givenState = null;

        // AND get state will return the given state.
        jest.spyOn(SkillsRankingService.getInstance(), "getSkillsRankingState").mockResolvedValue(givenState);

        // AND initialize will return a fresh initialized state
        const initialState = createFreshState(givenGroup, [SkillsRankingPhase.INITIAL]);
        jest
          .spyOn(SkillsRankingService.getInstance(), "updateSkillsRankingState")
          .mockImplementation(fakeUpdateState(initialState));
        jest.spyOn(SkillsRankingService.getInstance(), "getConfig").mockReturnValue(skillsRankingFeatureConfig);

        // WHEN it is rendered into the content.
        const onFinishCallback = jest.fn();

        render(<FakeChatList onFinishCallback={onFinishCallback} />);

        // AND I click on the `continue` button on the briefing component.
        await clickButton(BRIEFING_DATA_TEST_ID.SKILLS_RANKING_BRIEFING_CONTINUE_BUTTON);

        // AND I click `continue` on the Proof of value intro.
        await clickButton(PROOF_OF_VALUE_INTRO_DATA_TEST_ID.PROOF_OF_VALUE_INTRO_CONTINUE_BUTTON);

        // AND I click on the `cancel` on the proof of value component.
        await clickButton(PROOF_OF_VALUE_DATA_TEST_ID.CANCEL_BUTTON);

        // AND submit prior belief.
        //     1. Set the value.
        //        TODO: Find a way to drag an item.
        //     2. Click submit.
        await clickButton(PRIOR_BELIEF_DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_SUBMIT_BUTTON);

        // AND I submit the prior belief for skill.
        //     1. Set the value.
        //        TODO: Find a way to drag an item.
        //     2. Click submit.
        await clickButton(PRIOR_BELIEF_FOR_SKILL_DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_FOR_SKILL_SUBMIT_BUTTON);

        // AND I click on the disclosure component continue button.
        await clickButton(DISCLOSURE_DATA_TEST_ID.SKILLS_RANKING_DISCLOSURE_CONTINUE_BUTTON);

        // AND I click on the application willingness component continue button.
        await clickButton(APPLICATION_MOTIVATION_DATA_TEST_ID.SUBMIT_BUTTON);

        // AND I click on the application 24 hours continue button.
        await clickButton(APPLICATION_24H_DATA_TEST_ID.SUBMIT_BUTTON);

        // AND I click on the perceived rank component continue button.
        await clickButton(PERCEIVED_RANK_DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_SUBMIT_BUTTON);

        // AND I click on the perceived rank for skill component continue button.
        await clickButton(PERCEIVED_RANK_FOR_SKILL_DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_FOR_SKILL_SUBMIT_BUTTON);

        // AND I submit the prior belief for the opportunity skill requirement.
        await clickButton(
          OPPORTUNITY_SKILL_REQUIREMENT_DATA_TEST_ID.SKILLS_RANKING_OPPORTUNITY_SKILL_REQUIREMENT_SUBMIT_BUTTON
        );

        // THEN the conversation should be finished.
        expect(onFinishCallback).toHaveBeenCalled();

        // AND no errors/warnings should be logged.
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      }
    );
  });
});
