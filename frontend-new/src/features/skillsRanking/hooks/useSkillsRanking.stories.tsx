// stories/SkillsRankingFlow.stories.tsx
import { Meta, StoryObj } from "@storybook/react";
import React, { useState } from "react";
import { IChatMessage } from "src/chat/Chat.types";
import { useSkillsRanking } from "../hooks/useSkillsRanking";
import { getRandomSkillsRankingState } from "../utils/getSkillsRankingState";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "../types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { action } from "@storybook/addon-actions";
import { SkillsRankingService } from "../skillsRankingService/skillsRankingService";

// Define the default happy path
const defaultFlowGraph: Record<SkillsRankingPhase, SkillsRankingPhase | ((state: SkillsRankingState, overrides?: any) => SkillsRankingPhase)> = {
  [SkillsRankingPhase.INITIAL]: SkillsRankingPhase.BRIEFING,
  [SkillsRankingPhase.BRIEFING]: SkillsRankingPhase.PROOF_OF_VALUE,
  [SkillsRankingPhase.PROOF_OF_VALUE]: (state, overrides) =>
    overrides?.[SkillsRankingPhase.PROOF_OF_VALUE] === "cancel"
      ? SkillsRankingPhase.CANCELLED
      : SkillsRankingPhase.MARKET_DISCLOSURE,
  [SkillsRankingPhase.MARKET_DISCLOSURE]: SkillsRankingPhase.JOB_SEEKER_DISCLOSURE,
  [SkillsRankingPhase.JOB_SEEKER_DISCLOSURE]: SkillsRankingPhase.PERCEIVED_RANK,
  [SkillsRankingPhase.PERCEIVED_RANK]: SkillsRankingPhase.RETYPED_RANK,
  [SkillsRankingPhase.RETYPED_RANK]: SkillsRankingPhase.COMPLETED,
  [SkillsRankingPhase.COMPLETED]: SkillsRankingPhase.COMPLETED,
  [SkillsRankingPhase.CANCELLED]: SkillsRankingPhase.CANCELLED,
};

const getBehaviorMap = (
  overrides: Partial<Record<SkillsRankingPhase, string>> = {}
): Record<SkillsRankingPhase, string> => {
  return Object.fromEntries(
    Object.values(SkillsRankingPhase).map((phase) => [
      phase,
      overrides[phase] ?? "continue", // fill missing phases with "continue"
    ])
  ) as Record<SkillsRankingPhase, string>;
};

const setupMocks = (
  experimentGroup: SkillsRankingExperimentGroups,
  behaviorOverrides?: Partial<Record<SkillsRankingPhase, string>>
) => {
  const fullBehaviorMap = getBehaviorMap(behaviorOverrides);
  const sessionId = 999;
  let currentState: SkillsRankingState = getRandomSkillsRankingState(
    SkillsRankingPhase.INITIAL,
    experimentGroup
  );

  UserPreferencesStateService.getInstance().getActiveSessionId = () => sessionId;

  SkillsRankingService.getInstance().getSkillsRankingState = async () => currentState;

  SkillsRankingService.getInstance().updateSkillsRankingState = async (
    _sessionId,
    requestedPhase,
    perceived_rank_percentile,
    retyped_rank_percentile,
    metrics
  ) => {
    const flow = defaultFlowGraph[requestedPhase];
    const nextPhase =
      typeof flow === "function"
        ? flow(currentState, fullBehaviorMap)
        : flow;

    currentState = getRandomSkillsRankingState(
      nextPhase ?? SkillsRankingPhase.COMPLETED,
      experimentGroup
    );

    if (metrics) Object.assign(currentState, metrics);
    if (perceived_rank_percentile != null)
      currentState.perceived_rank_percentile = perceived_rank_percentile;
    if (retyped_rank_percentile != null)
      currentState.retyped_rank_percentile = retyped_rank_percentile;

    return currentState;
  };
};

export const SkillsRankingFlowTester = ({
  onFinishFlow,
  experimentGroup,
  behaviorOverrides,
}: {
  onFinishFlow: () => void;
  experimentGroup: SkillsRankingExperimentGroups;
  behaviorOverrides?: Partial<Record<SkillsRankingPhase, string>>;
}) => {
  const [messages, setMessages] = useState<IChatMessage<any>[]>([]);
  const addMessage = (message: IChatMessage<any>) => setMessages((prev) => [...prev, message]);
  const removeMessage = (id: string) => setMessages((prev) => prev.filter((m) => m.message_id !== id));
  const { showSkillsRanking } = useSkillsRanking(addMessage, removeMessage);

  React.useEffect(() => {
    showSkillsRanking(onFinishFlow).then();
  }, [showSkillsRanking, onFinishFlow]);

  return (
    <div style={{ padding: "1rem" }}>
      {messages.map((msg) => (
        <div key={msg.message_id} style={{ margin: "1rem 0" }}>
          {React.createElement(msg.component, msg.payload)}
        </div>
      ))}
    </div>
  );
};

const meta: Meta<typeof SkillsRankingFlowTester> = {
  title: "Features/SkillsRanking/FullFlow",
  component: SkillsRankingFlowTester,
  argTypes: {
    experimentGroup: {
      name: "Experiment Group",
      control: { type: "select" },
      options: Object.values(SkillsRankingExperimentGroups),
    },
    behaviorOverrides: {
      control: "object",
      description: "Map of phase -> outcome, e.g. { PROOF_OF_VALUE: 'cancel' }",
    },
  },
  decorators: [
    (Story, context) => {
      setupMocks(context.args.experimentGroup, context.args.behaviorOverrides);
      return <Story {...context.args} />;
    },
  ],
  args: {
    experimentGroup: SkillsRankingExperimentGroups.GROUP_1,
    behaviorOverrides: {},
  },
};

export default meta;

type Story = StoryObj<typeof SkillsRankingFlowTester>;

export const Group1: Story = {
  args: {
    experimentGroup: SkillsRankingExperimentGroups.GROUP_1,
  },
  render: (args) => <SkillsRankingFlowTester {...args} onFinishFlow={action("flow finished")} />,
};

export const Group2_Cancel: Story = {
  args: {
    experimentGroup: SkillsRankingExperimentGroups.GROUP_2,
    behaviorOverrides: {
      [SkillsRankingPhase.PROOF_OF_VALUE]: "cancel",
    },
  },
  render: (args) => <SkillsRankingFlowTester {...args} onFinishFlow={action("flow finished")} />,
};

export const Group3: Story = {
  args: {
    experimentGroup: SkillsRankingExperimentGroups.GROUP_3,
  },
  render: (args) => <SkillsRankingFlowTester {...args} onFinishFlow={action("flow finished")} />,
};

export const Group4: Story = {
  args: {
    experimentGroup: SkillsRankingExperimentGroups.GROUP_4,
  },
  render: (args) => <SkillsRankingFlowTester {...args} onFinishFlow={action("flow finished")} />,
};
