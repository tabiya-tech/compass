import type { Meta, StoryObj } from "@storybook/react";
import CareerReadinessList from "src/careerReadiness/pages/CareerReadinessList/CareerReadinessList";
import CareerReadinessService from "src/careerReadiness/services/CareerReadinessService";
import type { ModuleSummary } from "src/careerReadiness/types";

const meta: Meta<typeof CareerReadinessList> = {
  title: "CareerReadiness/CareerReadinessList",
  component: CareerReadinessList,
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof CareerReadinessList>;

const mockModules: ModuleSummary[] = [
  {
    id: "professional-identity",
    title: "Professional Identity & Skills Mapping",
    description:
      "Understand what professional identity means, learn the three types of skills, and how to articulate them to employers.",
    icon: "identity",
    status: "COMPLETED",
    sort_order: 1,
    input_placeholder: "Ask about professional identity and skills…",
    active_conversation_id: null,
  },
  {
    id: "cv-development",
    title: "CV Development",
    description: "Build a strong CV that highlights your skills and experience effectively.",
    icon: "cv",
    status: "NOT_STARTED",
    sort_order: 2,
    input_placeholder: "Ask about CV writing…",
    active_conversation_id: null,
  },
  {
    id: "cover-letter",
    title: "Cover Letter & Motivation Statement",
    description: "Write compelling cover letters and motivation statements tailored to each job application.",
    icon: "letter",
    status: "NOT_STARTED",
    sort_order: 3,
    input_placeholder: "Ask about cover letters…",
    active_conversation_id: null,
  },
  {
    id: "interview-preparation",
    title: "Interview Preparation",
    description: "Practice common interview questions, learn the STAR method, and build confidence for job interviews.",
    icon: "interview",
    status: "NOT_STARTED",
    sort_order: 4,
    input_placeholder: "Ask about interviews…",
    active_conversation_id: null,
  },
  {
    id: "workplace-readiness",
    title: "Workplace Readiness",
    description:
      "Develop essential workplace skills including communication, problem-solving, teamwork, and professional etiquette.",
    icon: "workplace",
    status: "NOT_STARTED",
    sort_order: 5,
    input_placeholder: "Ask about workplace readiness…",
    active_conversation_id: null,
  },
];

export const Default: Story = {
  decorators: [
    (Story) => {
      const service = CareerReadinessService.getInstance();
      (service as any).listModules = async () => ({ modules: mockModules });
      return <Story />;
    },
  ],
};

export const Loading: Story = {
  decorators: [
    (Story) => {
      const service = CareerReadinessService.getInstance();
      (service as any).listModules = () => new Promise(() => {});
      return <Story />;
    },
  ],
};

export const Empty: Story = {
  decorators: [
    (Story) => {
      const service = CareerReadinessService.getInstance();
      (service as any).listModules = async () => ({ modules: [] });
      return <Story />;
    },
  ],
};

export const LoadError: Story = {
  decorators: [
    (Story) => {
      const service = CareerReadinessService.getInstance();
      (service as any).listModules = async () => {
        throw new Error("Unable to load modules. Please try again.");
      };
      return <Story />;
    },
  ],
};
