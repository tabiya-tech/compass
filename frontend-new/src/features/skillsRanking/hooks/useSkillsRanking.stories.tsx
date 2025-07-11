import { Meta, StoryObj } from "@storybook/react";
import React, { useState } from "react";
import { IChatMessage } from "src/chat/Chat.types";
import { useSkillsRanking } from "./useSkillsRanking";
import { getRandomSkillsRankingState } from "../utils/getSkillsRankingState";
import { SkillsRankingExperimentGroups, SkillsRankingPhase, SkillsRankingState } from "../types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { action } from "@storybook/addon-actions";
import { SkillsRankingService } from "../skillsRankingService/skillsRankingService";

const PHASES = [
  SkillsRankingPhase.INITIAL,
  SkillsRankingPhase.BRIEFING,
  SkillsRankingPhase.EFFORT,
  SkillsRankingPhase.DISCLOSURE,
  SkillsRankingPhase.PERCEIVED_RANK,
  SkillsRankingPhase.RETYPED_RANK,
  SkillsRankingPhase.COMPLETED,
];

const setupMocks = (experimentGroup: SkillsRankingExperimentGroups) => {
  const sessionId = 999;
  let currentPhaseIndex = 0;

  // Always return the same session id
  UserPreferencesStateService.getInstance().getActiveSessionId = () => sessionId;

  // Return the current state for the current phase
  SkillsRankingService.getInstance().getSkillsRankingState = async () => {
    const state = getRandomSkillsRankingState(PHASES[currentPhaseIndex], experimentGroup);
    return state;
  };

  // Move to the next phase and return the new state
  SkillsRankingService.getInstance().updateSkillsRankingState = async (
    _sessionId: number,
    phase: SkillsRankingPhase,
    cancelled_after?: string,
    perceived_rank_percentile?: number,
    retyped_rank_percentile?: number
  ) => {
    // Find the next phase in the flow
    currentPhaseIndex = PHASES.indexOf(phase) + 1;
    const nextPhase = PHASES[currentPhaseIndex] ?? SkillsRankingPhase.COMPLETED;
    const newState = getRandomSkillsRankingState(nextPhase, experimentGroup);
    // Optionally set the extra fields if provided
    if (cancelled_after !== undefined) newState.cancelled_after = cancelled_after;
    if (perceived_rank_percentile !== undefined) newState.perceived_rank_percentile = perceived_rank_percentile;
    if (retyped_rank_percentile !== undefined) newState.retyped_rank_percentile = retyped_rank_percentile;
    return newState;
  };
};

export const SkillsRankingFlowTester = ({ onFinishFlow, experimentGroup }: { onFinishFlow: () => void, experimentGroup: SkillsRankingExperimentGroups }) => {
  const [messages, setMessages] = useState<IChatMessage<any>[]>([]);
  const addMessage = (message: IChatMessage<any>) => setMessages((prev) => [...prev, message]);
  const removeMessage = (id: string) => setMessages((prev) => prev.filter((m) => m.message_id !== id));

  const { showSkillsRanking } = useSkillsRanking(addMessage, removeMessage);

  React.useEffect(() => {
    showSkillsRanking(onFinishFlow);
  }, []);

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.message_id} style={{ margin: "1rem 0" }}>
          {React.createElement(msg.component, msg.payload)}
        </div>
      ))}
    </div>
  );
};

const meta: Meta<typeof SkillsRankingFlowTester> = {
  title: "Features/SkillsRanking/Flow",
  component: SkillsRankingFlowTester,
  decorators: [
    (Story, context) => {
      // Setup mocks for the correct group before each story
      setupMocks(context.args.experimentGroup);
      return <Story {...context.args} />;
    }
  ],
  argTypes: {
    experimentGroup: {
      name: "Experiment Group",
      control: { type: "select" },
      options: Object.values(SkillsRankingExperimentGroups),
    },
  },
  args: {
    experimentGroup: SkillsRankingExperimentGroups.GROUP_1,
  }
};

export default meta;

type Story = StoryObj<typeof SkillsRankingFlowTester>;

export const Group1: Story = {
  args: { experimentGroup: SkillsRankingExperimentGroups.GROUP_1 },
  render: (args) => <SkillsRankingFlowTester {...args} onFinishFlow={action("flow finished")} />,
};

export const Group2: Story = {
  args: { experimentGroup: SkillsRankingExperimentGroups.GROUP_2 },
  render: (args) => <SkillsRankingFlowTester {...args} onFinishFlow={action("flow finished")} />,
};

export const Group3: Story = {
  args: { experimentGroup: SkillsRankingExperimentGroups.GROUP_3 },
  render: (args) => <SkillsRankingFlowTester {...args} onFinishFlow={action("flow finished")} />,
};

export const Group4: Story = {
  args: { experimentGroup: SkillsRankingExperimentGroups.GROUP_4 },
  render: (args) => <SkillsRankingFlowTester {...args} onFinishFlow={action("flow finished")} />,
};