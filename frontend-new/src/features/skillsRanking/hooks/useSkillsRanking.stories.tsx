// stories/SkillsRankingFlow.stories.tsx
import { Meta, StoryObj } from "@storybook/react";
import React, { useState, useEffect, useRef } from "react";
import { IChatMessage } from "src/chat/Chat.types";
import { useSkillsRanking } from "../hooks/useSkillsRanking";
import { getRandomSkillsRankingState } from "../utils/getSkillsRankingState";
import { SkillsRankingExperimentGroups, SkillsRankingPhase, SkillsRankingState, getLatestPhaseName } from "../types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { action } from "@storybook/addon-actions";
import { SkillsRankingService } from "../skillsRankingService/skillsRankingService";

// Mock session ID for testing
const TEST_SESSION_ID = 123;

// Define the phase flow for each experiment group
const getPhaseFlowForGroup = (experimentGroup: SkillsRankingExperimentGroups): SkillsRankingPhase[] => {
  switch (experimentGroup) {
    case SkillsRankingExperimentGroups.GROUP_1:
    case SkillsRankingExperimentGroups.GROUP_3:
      // Full flow - includes market disclosure and retyped rank
      return [
        SkillsRankingPhase.INITIAL,
        SkillsRankingPhase.BRIEFING,
        SkillsRankingPhase.PROOF_OF_VALUE,
        SkillsRankingPhase.MARKET_DISCLOSURE,
        SkillsRankingPhase.JOB_SEEKER_DISCLOSURE,
        SkillsRankingPhase.PERCEIVED_RANK,
        SkillsRankingPhase.RETYPED_RANK,
        SkillsRankingPhase.COMPLETED,
      ];
    case SkillsRankingExperimentGroups.GROUP_2:
    case SkillsRankingExperimentGroups.GROUP_4:
      // Same flow but market disclosure auto-skips internally
      return [
        SkillsRankingPhase.INITIAL,
        SkillsRankingPhase.BRIEFING,
        SkillsRankingPhase.PROOF_OF_VALUE,
        SkillsRankingPhase.MARKET_DISCLOSURE,
        SkillsRankingPhase.JOB_SEEKER_DISCLOSURE,
        SkillsRankingPhase.PERCEIVED_RANK,
        SkillsRankingPhase.COMPLETED,
      ];
    default:
      return [];
  }
};

// Create a proper mock service that maintains state
class MockSkillsRankingService {
  private currentState: SkillsRankingState | null = null;
  private experimentGroup: SkillsRankingExperimentGroups;
  private phaseFlow: SkillsRankingPhase[];
  private currentPhaseIndex: number = 0;
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
    perceived_rank_percentile?: number,
    retyped_rank_percentile?: number,
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
      phase === SkillsRankingPhase.MARKET_DISCLOSURE &&
      (this.experimentGroup === SkillsRankingExperimentGroups.GROUP_2 ||
        this.experimentGroup === SkillsRankingExperimentGroups.GROUP_4)
    ) {
      targetPhase = SkillsRankingPhase.JOB_SEEKER_DISCLOSURE;
      console.log(
        `[Mock] Skipping MARKET_DISCLOSURE for group ${this.experimentGroup}, going to JOB_SEEKER_DISCLOSURE`
      );
    }

    // If PerceivedRank is transitioning to RETYPED_RANK, check if we should skip to COMPLETED
    if (
      phase === SkillsRankingPhase.RETYPED_RANK &&
      (this.experimentGroup === SkillsRankingExperimentGroups.GROUP_2 ||
        this.experimentGroup === SkillsRankingExperimentGroups.GROUP_4)
    ) {
      targetPhase = SkillsRankingPhase.COMPLETED;
      console.log(`[Mock] Skipping RETYPED_RANK for group ${this.experimentGroup}, going to COMPLETED`);
    }

    // Create new state with the target phase
    this.currentState = getRandomSkillsRankingState(targetPhase, this.experimentGroup);

    // For PROOF_OF_VALUE phase, ensure we don't have cancelled_after or succeeded_after
    // as this would make the component think it's already finished
    if (targetPhase === SkillsRankingPhase.PROOF_OF_VALUE) {
      this.currentState.cancelled_after = undefined;
      this.currentState.succeeded_after = undefined;
      this.currentState.puzzles_solved = 0;
      this.currentState.correct_rotations = 0;
      this.currentState.clicks_count = 0;
    }

    console.log(`[Mock] Created state with phases:`, this.currentState.phases);
    console.log(`[Mock] Latest phase before fix:`, getLatestPhaseName(this.currentState));

    // Ensure the state is actually in the target phase
    if (this.currentState.phases && this.currentState.phases.length > 0) {
      this.currentState.phases[this.currentState.phases.length - 1] = {
        name: targetPhase,
        time: new Date().toISOString(),
      };
    } else {
      // If phases array is empty or doesn't exist, create it
      this.currentState.phases = [
        {
          name: targetPhase,
          time: new Date().toISOString(),
        },
      ];
    }

    console.log(`[Mock] State phases after fix:`, this.currentState.phases);
    console.log(`[Mock] Latest phase after fix:`, getLatestPhaseName(this.currentState));

    // Double-check that the phase is correct
    const actualPhase = getLatestPhaseName(this.currentState);
    if (actualPhase !== targetPhase) {
      console.warn(`[Mock] Phase mismatch! Expected: ${targetPhase}, Got: ${actualPhase}`);
    }

    // Update state with provided data
    if (perceived_rank_percentile !== undefined) {
      this.currentState.perceived_rank_percentile = perceived_rank_percentile;
    }
    if (retyped_rank_percentile !== undefined) {
      this.currentState.retyped_rank_percentile = retyped_rank_percentile;
    }
    if (metrics) {
      Object.assign(this.currentState, metrics);
    }

    // Update phases array to include the new phase
    if (this.currentState.phases) {
      this.currentState.phases.push({
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

export const Group1_TimeBased: Story = {
  args: {
    experimentGroup: SkillsRankingExperimentGroups.GROUP_1,
  },
  render: (args) => <SkillsRankingFlowTester {...args} onFinishFlow={action("Group 1 flow finished")} />,
};

export const Group2_WorkBased: Story = {
  args: {
    experimentGroup: SkillsRankingExperimentGroups.GROUP_2,
  },
  render: (args) => <SkillsRankingFlowTester {...args} onFinishFlow={action("Group 2 flow finished")} />,
};

export const Group3_WorkBased: Story = {
  args: {
    experimentGroup: SkillsRankingExperimentGroups.GROUP_3,
  },
  render: (args) => <SkillsRankingFlowTester {...args} onFinishFlow={action("Group 3 flow finished")} />,
};

export const Group4_TimeBased: Story = {
  args: {
    experimentGroup: SkillsRankingExperimentGroups.GROUP_4,
  },
  render: (args) => <SkillsRankingFlowTester {...args} onFinishFlow={action("Group 4 flow finished")} />,
};

// REVIEW: The full flow is not working, it is rendering infinitely.
