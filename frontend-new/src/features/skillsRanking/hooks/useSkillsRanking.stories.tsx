import { Meta, StoryObj } from "@storybook/react";
import React, { useEffect, useRef, useState } from "react";
import { IChatMessage } from "src/chat/Chat.types";
import { useSkillsRanking } from "src/features/skillsRanking/hooks/useSkillsRanking";
import { getRandomSkillsRankingState } from "src/features/skillsRanking/utils/getSkillsRankingState";
import {
  getLatestPhaseName,
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { action } from "@storybook/addon-actions";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";

// Mock session ID for testing
const TEST_SESSION_ID = 123;

// Define the phase flow for each experiment group
const getPhaseFlowForGroup = (experimentGroup: SkillsRankingExperimentGroups): SkillsRankingPhase[] => {
  switch (experimentGroup) {
    case SkillsRankingExperimentGroups.GROUP_1:
      // Group 1: Opportunity skill requirement before disclosure
      return [
        SkillsRankingPhase.INITIAL,
        SkillsRankingPhase.BRIEFING,
        SkillsRankingPhase.PROOF_OF_VALUE_INTRO,
        SkillsRankingPhase.PROOF_OF_VALUE,
        SkillsRankingPhase.PRIOR_BELIEF,
        SkillsRankingPhase.PRIOR_BELIEF_FOR_SKILL,
        SkillsRankingPhase.OPPORTUNITY_SKILL_REQUIREMENT,
        SkillsRankingPhase.DISCLOSURE,
        SkillsRankingPhase.COMPLETED,
      ];
    case SkillsRankingExperimentGroups.GROUP_2:
    case SkillsRankingExperimentGroups.GROUP_3:
      // Full flow: disclosure before application questions, then perceived rank questions, then opportunity requirement
      return [
        SkillsRankingPhase.INITIAL,
        SkillsRankingPhase.BRIEFING,
        SkillsRankingPhase.PROOF_OF_VALUE_INTRO,
        SkillsRankingPhase.PROOF_OF_VALUE,
        SkillsRankingPhase.PRIOR_BELIEF,
        SkillsRankingPhase.PRIOR_BELIEF_FOR_SKILL,
        SkillsRankingPhase.DISCLOSURE,
        SkillsRankingPhase.APPLICATION_WILLINGNESS,
        SkillsRankingPhase.APPLICATION_24H,
        SkillsRankingPhase.PERCEIVED_RANK,
        SkillsRankingPhase.PERCEIVED_RANK_FOR_SKILL,
        SkillsRankingPhase.OPPORTUNITY_SKILL_REQUIREMENT,
        SkillsRankingPhase.COMPLETED,
      ];
    default:
      return [];
  }
};

// Create a proper mock service that maintains state
class MockSkillsRankingService {
  private currentState: SkillsRankingState | null = null;
  private readonly experimentGroup: SkillsRankingExperimentGroups;
  private phaseFlow: SkillsRankingPhase[];
  private isInitialized: boolean = false;

  constructor(experimentGroup: SkillsRankingExperimentGroups) {
    this.experimentGroup = experimentGroup;
    this.phaseFlow = getPhaseFlowForGroup(experimentGroup);
  }

  async getSkillsRankingState(sessionId: number): Promise<SkillsRankingState | null> {
    // For testing, we want to start fresh each time, so return null
    // This will trigger initializeSkillsRankingState()
    if (this.isInitialized) {
      return this.currentState;
    }
    return null;
  }

  async updateSkillsRankingState(
    sessionId: number,
    phase: SkillsRankingPhase,
    options?: {
      perceived_rank_percentile?: number;
      perceived_rank_for_skill?: number;
      prior_belief?: number;
      prior_belief_for_skill?: number;
      application_willingness?: { value: number; label: string };
      application_24h?: number;
      opportunity_skill_requirement?: number;
    },
    metrics?: any
  ): Promise<SkillsRankingState> {
    // The components call updateSkillsRankingState with the phase they want to transition TO
    // So if BRIEFING calls with PROOF_OF_VALUE, it wants to go to PROOF_OF_VALUE

    console.log(`[Mock] updateSkillsRankingState called with target phase: ${phase}`);

    // If this is the first call, initialize the state
    if (!this.isInitialized) {
      this.currentState = getRandomSkillsRankingState(SkillsRankingPhase.INITIAL, this.experimentGroup);
      this.isInitialized = true;
    }

    // Handle conditional transitions based on experiment group
    let targetPhase = phase;

    // If ProofOfValue is transitioning to MARKET_DISCLOSURE, check if we should skip to JOB_SEEKER_DISCLOSURE
    if (
      phase === SkillsRankingPhase.DISCLOSURE &&
      (this.experimentGroup === SkillsRankingExperimentGroups.GROUP_2)
    ) {
      targetPhase = SkillsRankingPhase.DISCLOSURE;
      console.log(
        `[Mock] Skipping MARKET_DISCLOSURE for group ${this.experimentGroup}, going to JOB_SEEKER_DISCLOSURE`
      );
    }

    // No skipping needed - PERCEIVED_RANK should proceed normally through PERCEIVED_RANK_FOR_SKILL and OPPORTUNITY_SKILL_REQUIREMENT

    // Create new state with the target phase
    this.currentState = getRandomSkillsRankingState(targetPhase, this.experimentGroup);

    // For PROOF_OF_VALUE phase, ensure we don't have cancelled_after or succeeded_after
    // as this would make the component think it's already finished
    if (targetPhase === SkillsRankingPhase.PROOF_OF_VALUE) {
      this.currentState.metadata.cancelled_after = undefined;
      this.currentState.metadata.succeeded_after = undefined;
      this.currentState.metadata.puzzles_solved = 0;
      this.currentState.metadata.correct_rotations = 0;
      this.currentState.metadata.clicks_count = 0;
    }

    console.log(`[Mock] Created state with phase:`, this.currentState.phase);
    console.log(`[Mock] Latest phase before fix:`, getLatestPhaseName(this.currentState));

    // Ensure the state is actually in the target phase
    if (this.currentState.phase && this.currentState.phase.length > 0) {
      this.currentState.phase[this.currentState.phase.length - 1] = {
        name: targetPhase,
        time: new Date().toISOString(),
      };
    } else {
      // If phase array is empty or doesn't exist, create it
      this.currentState.phase = [
        {
          name: targetPhase,
          time: new Date().toISOString(),
        },
      ];
    }

    console.log(`[Mock] State phase after fix:`, this.currentState.phase);
    console.log(`[Mock] Latest phase after fix:`, getLatestPhaseName(this.currentState));

    // Double-check that the phase is correct
    const actualPhase = getLatestPhaseName(this.currentState);
    if (actualPhase !== targetPhase) {
      console.warn(`[Mock] Phase mismatch! Expected: ${targetPhase}, Got: ${actualPhase}`);
    }

    // Update state with provided data
    if (options?.perceived_rank_percentile !== undefined) {
      this.currentState.user_responses.perceived_rank_percentile = options.perceived_rank_percentile;
    }
    if (metrics) {
      Object.assign(this.currentState.metadata, metrics);
    }

    // Update phase array to include the new phase
    if (this.currentState.phase) {
      this.currentState.phase.push({
        name: targetPhase,
        time: new Date().toISOString(),
      });
    }

    console.log(`[Mock] Returning state with phase: ${getLatestPhaseName(this.currentState)}`);
    return this.currentState;
  }

  async updateSkillsRankingMetrics(sessionId: number, metrics: any): Promise<SkillsRankingState> {
    if (this.currentState) {
      Object.assign(this.currentState, metrics);
    }
    return this.currentState!;
  }

  isSkillsRankingFeatureEnabled(): boolean {
    return true;
  }

  getConfig(): any {
    return {
      config: {
        compensationAmount: "R20",
        jobPlatformUrl: "SAYouth.mobi",
        defaultTypingDurationMs: 5000,
        shortTypingDurationMs: 3000,
        longTypingDurationMs: 10000,
      },
    };
  }
}

// Setup mocks for a specific experiment group
const setupMocks = (experimentGroup: SkillsRankingExperimentGroups) => {
  const mockService = new MockSkillsRankingService(experimentGroup);

  // Mock UserPreferencesStateService
  UserPreferencesStateService.getInstance().getActiveSessionId = () => TEST_SESSION_ID;

  // Mock SkillsRankingService methods
  SkillsRankingService.getInstance().getSkillsRankingState = mockService.getSkillsRankingState.bind(mockService);
  SkillsRankingService.getInstance().updateSkillsRankingState = mockService.updateSkillsRankingState.bind(mockService);
  SkillsRankingService.getInstance().updateSkillsRankingMetrics =
    mockService.updateSkillsRankingMetrics.bind(mockService);
  SkillsRankingService.getInstance().isSkillsRankingFeatureEnabled =
    mockService.isSkillsRankingFeatureEnabled.bind(mockService);
  SkillsRankingService.getInstance().getConfig = mockService.getConfig.bind(mockService);

  // Add createDebouncedMetricsUpdater method for ProofOfValue component
  SkillsRankingService.getInstance().createDebouncedMetricsUpdater = () => ({
    update: () => {},
    forceUpdate: () => {},
    abort: () => {},
    cleanup: () => {},
  });
};

export const SkillsRankingFlowTester = ({
  onFinishFlow,
  experimentGroup,
}: {
  onFinishFlow: () => void;
  experimentGroup: SkillsRankingExperimentGroups;
}) => {
  const [messages, setMessages] = useState<IChatMessage<any>[]>([]);
  const hasStartedRef = useRef(false);
  const hasFinishedRef = useRef(false);

  const addMessage = (message: IChatMessage<any>) => {
    setMessages((prev) => [...prev, message]);
  };

  const removeMessage = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.message_id !== id));
  };

  const { showSkillsRanking } = useSkillsRanking(addMessage, removeMessage);

  useEffect(() => {
    // Only start the flow once and prevent multiple finishes
    if (!hasStartedRef.current && !hasFinishedRef.current) {
      hasStartedRef.current = true;
      showSkillsRanking(() => {
        if (!hasFinishedRef.current && typeof onFinishFlow === "function") {
          hasFinishedRef.current = true;
          onFinishFlow();
        } else {
          console.log("Flow finished but onFinishFlow is not a function or already finished");
        }
      }).catch(console.error);
    }
  }, [showSkillsRanking, onFinishFlow]);

  return (
    <div style={{ padding: "1rem", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ marginBottom: "1rem", padding: "0.5rem", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
        <strong>Experiment Group:</strong> {experimentGroup}
        <br />
        <strong>Messages:</strong> {messages.length}
      </div>

      {messages.map((msg, index) => (
        <div key={msg.message_id} style={{ margin: "1rem 0" }}>
          <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: "0.5rem" }}>
            Message {index + 1}: {msg.component.name}
          </div>
          {React.createElement(msg.component, msg.payload)}
        </div>
      ))}

      {messages.length === 0 && (
        <div style={{ textAlign: "center", color: "#666", padding: "2rem" }}>Loading skills ranking flow...</div>
      )}
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
  },
  decorators: [
    (Story, context) => {
      setupMocks(context.args.experimentGroup);
      return <Story {...context.args} />;
    },
  ],
  args: {
    experimentGroup: SkillsRankingExperimentGroups.GROUP_1,
  },
};

export default meta;

type Story = StoryObj<typeof SkillsRankingFlowTester>;

export const Group1_NoDisclosure: Story = {
  args: {
    experimentGroup: SkillsRankingExperimentGroups.GROUP_1,
  },
  render: (args) => <SkillsRankingFlowTester {...args} onFinishFlow={action("Group 1 flow finished")} />,
};

export const Group2_MostDemandedOnly: Story = {
  args: {
    experimentGroup: SkillsRankingExperimentGroups.GROUP_2,
  },
  render: (args) => <SkillsRankingFlowTester {...args} onFinishFlow={action("Group 2 flow finished")} />,
};

export const Group3_MostAndLeastDemanded: Story = {
  args: {
    experimentGroup: SkillsRankingExperimentGroups.GROUP_3,
  },
  render: (args) => <SkillsRankingFlowTester {...args} onFinishFlow={action("Group 3 flow finished")} />,
};

