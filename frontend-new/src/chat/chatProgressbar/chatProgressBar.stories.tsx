import type { Meta, StoryObj } from "@storybook/react";
import ChatProgressBar from "./ChatProgressBar";
import { ConversationPhase, PreferenceSubPhase } from "./types";

const meta: Meta<typeof ChatProgressBar> = {
  title: "Chat/ChatProgressBar",
  component: ChatProgressBar,
  tags: ["autodocs"],
  argTypes: {
    phase: {
      options: Object.values(ConversationPhase),
      control: { type: "select" },
    },
    sub_phase: {
      options: [null, ...Object.values(PreferenceSubPhase)],
      control: { type: "select" },
      description: "Preference-elicitation sub-phase. Only meaningful when phase === PREFERENCE_ELICITATION.",
    },
    percentage: {
      control: { type: "range", min: 0, max: 100, step: 1 },
    },
    current: { control: { type: "number" } },
    total: { control: { type: "number" } },
  },
};

export default meta;

type Story = StoryObj<typeof ChatProgressBar>;

// ============================================================================
// Top-level journey phases
// ============================================================================

export const Initializing: Story = {
  args: {
    percentage: 0,
    phase: ConversationPhase.INITIALIZING,
    current: null,
    total: null,
    sub_phase: null,
  },
};

export const Introduction: Story = {
  args: {
    percentage: 0,
    phase: ConversationPhase.INTRO,
    current: null,
    total: null,
    sub_phase: null,
  },
};

export const CollectExperiences: Story = {
  args: {
    percentage: 5,
    phase: ConversationPhase.COLLECT_EXPERIENCES,
    current: 1,
    total: 4,
    sub_phase: null,
  },
};

export const DiveIn: Story = {
  args: {
    percentage: 40,
    phase: ConversationPhase.DIVE_IN,
    current: 2,
    total: 6,
    sub_phase: null,
  },
};

export const Recommendation: Story = {
  args: {
    percentage: 85,
    phase: ConversationPhase.RECOMMENDATION,
    current: null,
    total: null,
    sub_phase: null,
  },
};

export const Ended: Story = {
  args: {
    percentage: 100,
    phase: ConversationPhase.ENDED,
    current: null,
    total: null,
    sub_phase: null,
  },
};

export const Unknown: Story = {
  args: {
    percentage: 0,
    phase: ConversationPhase.UNKNOWN,
    current: null,
    total: null,
    sub_phase: null,
  },
};

// ============================================================================
// PREFERENCE_ELICITATION sub-phases — one story per sub-phase
//
// These are the states that are tedious to reach by chatting through the
// agent. Use these to visually verify the labels/counter on the progress
// bar without driving the agent end-to-end.
// ============================================================================

export const PrefElicit_ExperienceQuestions: Story = {
  name: "Pref Elicit / EXPERIENCE_QUESTIONS",
  args: {
    percentage: 72,
    phase: ConversationPhase.PREFERENCE_ELICITATION,
    current: null,
    total: null,
    sub_phase: PreferenceSubPhase.EXPERIENCE_QUESTIONS,
  },
};

export const PrefElicit_Vignettes: Story = {
  name: "Pref Elicit / VIGNETTES",
  args: {
    percentage: 78,
    phase: ConversationPhase.PREFERENCE_ELICITATION,
    current: null,
    total: null,
    sub_phase: PreferenceSubPhase.VIGNETTES,
  },
};

export const PrefElicit_FollowUp: Story = {
  name: "Pref Elicit / FOLLOW_UP",
  args: {
    percentage: 80,
    phase: ConversationPhase.PREFERENCE_ELICITATION,
    current: null,
    total: null,
    sub_phase: PreferenceSubPhase.FOLLOW_UP,
  },
};

export const PrefElicit_Gate: Story = {
  name: "Pref Elicit / GATE",
  args: {
    percentage: 84,
    phase: ConversationPhase.PREFERENCE_ELICITATION,
    current: null,
    total: null,
    sub_phase: PreferenceSubPhase.GATE,
  },
};

export const PrefElicit_BWS_Start: Story = {
  name: "Pref Elicit / BWS (1 of 12)",
  args: {
    percentage: 86,
    phase: ConversationPhase.PREFERENCE_ELICITATION,
    current: 1,
    total: 12,
    sub_phase: PreferenceSubPhase.BWS,
  },
};

export const PrefElicit_BWS_Middle: Story = {
  name: "Pref Elicit / BWS (6 of 12)",
  args: {
    percentage: 92,
    phase: ConversationPhase.PREFERENCE_ELICITATION,
    current: 6,
    total: 12,
    sub_phase: PreferenceSubPhase.BWS,
  },
};

export const PrefElicit_BWS_End: Story = {
  name: "Pref Elicit / BWS (12 of 12)",
  args: {
    percentage: 98,
    phase: ConversationPhase.PREFERENCE_ELICITATION,
    current: 12,
    total: 12,
    sub_phase: PreferenceSubPhase.BWS,
  },
};

export const PrefElicit_Wrapup: Story = {
  name: "Pref Elicit / WRAPUP",
  args: {
    percentage: 99,
    phase: ConversationPhase.PREFERENCE_ELICITATION,
    current: null,
    total: null,
    sub_phase: PreferenceSubPhase.WRAPUP,
  },
};

// Defensive: if backend ever omits sub_phase, this is what users will see.
export const PrefElicit_NoSubPhase: Story = {
  name: "Pref Elicit / (no sub_phase — fallback label)",
  args: {
    percentage: 72,
    phase: ConversationPhase.PREFERENCE_ELICITATION,
    current: null,
    total: null,
    sub_phase: null,
  },
};
