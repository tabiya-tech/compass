import { Meta } from "@storybook/react";
import RestoreExperiencesDrawer from "src/experiences/experiencesDrawer/components/restoreExperiencesDrawer/RestoreExperiencesDrawer";
import {
  generateRandomExperiences,
  mockExperiences,
} from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";
import { DiveInPhase } from "src/experiences/experienceService/experiences.types";
import ExperienceService from "src/experiences/experienceService/experienceService";

const currentExperiences = [mockExperiences[0]];
const deletedExperiences = [mockExperiences[1]].map((e) => ({
  ...e,
  exploration_phase: DiveInPhase.PROCESSED,
  deleted: true,
}));

const meta: Meta<typeof RestoreExperiencesDrawer> = {
  title: "Experiences/RestoreExperiencesDrawer",
  component: RestoreExperiencesDrawer,
  tags: ["autodocs"],
  argTypes: {
    onClose: { action: "onClose" },
    onRestore: { action: "onRestore" },
    onExperiencesRestored: { action: "onExperiencesRestored" },
  },
  args: {
    isOpen: true,
    sessionId: 123,
    currentExperiences,
  },
};

export default meta;

const ServiceMockWrapper: React.FC<{ children: React.ReactNode; mock: () => Promise<any> }> = ({ children, mock }) => {
  ExperienceService.getInstance().getExperiences = mock;
  return <>{children}</>;
};

export const Default = {
  args: {},
  decorators: [
    (Story: React.FC) => {
      return (
        <ServiceMockWrapper mock={() => Promise.resolve([...currentExperiences, ...deletedExperiences])}>
          <Story />
        </ServiceMockWrapper>
      );
    },
  ],
};

export const Empty = {
  args: {},
  decorators: [
    (Story: React.FC) => (
      <ServiceMockWrapper mock={() => Promise.resolve(currentExperiences)}>
        <Story />
      </ServiceMockWrapper>
    ),
  ],
};

export const Loading = {
  args: {},
  decorators: [
    (Story: React.FC) => (
      <ServiceMockWrapper mock={() => new Promise(() => {})}>
        <Story />
      </ServiceMockWrapper>
    ),
  ],
};

export const ShownWithMultipleDeletedExperiences = {
  args: {},
  decorators: [
    (Story: React.FC) => (
      <ServiceMockWrapper mock={() => Promise.resolve(generateRandomExperiences(10))}>
        <Story />
      </ServiceMockWrapper>
    ),
  ],
};
