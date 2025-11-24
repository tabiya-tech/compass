import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingCompletionAdvice from "src/features/skillsRanking/components/skillsRankingCompletionAdvice/SkillsRankingCompletionAdvice";
import { getRandomSkillsRankingState } from "src/features/skillsRanking/utils/getSkillsRankingState";
import {
  SkillsRankingPhase,
  SkillsRankingState,
  SkillsRankingExperimentGroups,
  SkillsRankingPhaseWithTime,
} from "src/features/skillsRanking/types";
import { shouldSkipMarketDisclosure } from "src/features/skillsRanking/utils/createMessages";
import { action } from "@storybook/addon-actions";

import { Box } from "@mui/material";

const FixedWidthWrapper = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ width: "600px" }}>{children}</Box>
);

const createPhaseArray = (phase: SkillsRankingPhase): SkillsRankingPhaseWithTime[] => {
  return [
    {
      name: phase,
      time: new Date().toISOString(),
    },
  ];
};

const meta: Meta<typeof SkillsRankingCompletionAdvice> = {
  title: "Features/SkillsRanking/SkillsRankingCompletionAdvice",
  component: SkillsRankingCompletionAdvice,
  tags: ["autodocs"],
  decorators: [
    (Story) => {
      return (
        <FixedWidthWrapper>
          <Story />
        </FixedWidthWrapper>
      );
    },
  ],
};

export default meta;

type Story = StoryObj<typeof SkillsRankingCompletionAdvice>;

const BaseArgs = {
  onFinish: async (state: SkillsRankingState) => {
    action("onFinish")(state);
  },
  skillsRankingState: (() => {
    const base = getRandomSkillsRankingState();
    base.phase = createPhaseArray(SkillsRankingPhase.COMPLETED);
    base.metadata.completed_at = new Date().toISOString();
    return base;
  })(),
};

// GROUP 1: TIME_BASED - Should show advice (has seen market disclosure)
export const Group1_TimeBased: Story = {
  args: {
    ...BaseArgs,
    skillsRankingState: {
      ...BaseArgs.skillsRankingState,
      metadata: { ...BaseArgs.skillsRankingState.metadata, experiment_group: SkillsRankingExperimentGroups.GROUP_1 },
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Group 1 (TIME_BASED) - Should show completion advice because user has seen market disclosure",
      },
    },
  },
};

// GROUP 2: WORK_BASED - Should NOT show advice (has NOT seen market disclosure)
export const Group2_WorkBased: Story = {
  args: {
    ...BaseArgs,
    skillsRankingState: {
      ...BaseArgs.skillsRankingState,
      metadata: { ...BaseArgs.skillsRankingState.metadata, experiment_group: SkillsRankingExperimentGroups.GROUP_2 },
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Group 2 (WORK_BASED) - Should NOT show completion advice because user has NOT seen market disclosure",
      },
    },
  },
};

// GROUP 3: WORK_BASED - Should show advice (has seen market disclosure)
export const Group3_WorkBased: Story = {
  args: {
    ...BaseArgs,
    skillsRankingState: {
      ...BaseArgs.skillsRankingState,
      metadata: { ...BaseArgs.skillsRankingState.metadata, experiment_group: SkillsRankingExperimentGroups.GROUP_3 },
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Group 3 (WORK_BASED) - Should show completion advice because user has seen market disclosure",
      },
    },
  },
};

// Helper story to show which groups should/shouldn't see the advice
export const MarketDisclosureGroups: Story = {
  args: {
    ...BaseArgs,
    skillsRankingState: {
      ...BaseArgs.skillsRankingState,
      metadata: { ...BaseArgs.skillsRankingState.metadata, experiment_group: SkillsRankingExperimentGroups.GROUP_1 },
    },
  },
  parameters: {
    docs: {
      description: {
        story: `
**Groups that SHOULD see completion advice (have seen market disclosure):**
- Group 1 (TIME_BASED): ${!shouldSkipMarketDisclosure(SkillsRankingExperimentGroups.GROUP_1) ? "✅ Shows advice" : "❌ No advice"}
- Group 3 (WORK_BASED): ${!shouldSkipMarketDisclosure(SkillsRankingExperimentGroups.GROUP_3) ? "✅ Shows advice" : "❌ No advice"}

**Groups that should NOT see completion advice (have NOT seen market disclosure):**
- Group 2 (WORK_BASED): ${shouldSkipMarketDisclosure(SkillsRankingExperimentGroups.GROUP_2) ? "❌ No advice" : "✅ Shows advice"}
        `,
      },
    },
  },
}; 