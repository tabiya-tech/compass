import { Meta } from "@storybook/react";
import RestoreExperiencesDrawer from "src/experiences/experiencesDrawer/components/restoreExperiencesDrawer/RestoreExperiencesDrawer";
import { mockExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";
import { DiveInPhase } from "src/experiences/experienceService/experiences.types";
import ExperienceService from "src/experiences/experienceService/experienceService";

const currentExperiences = [mockExperiences[0]];
const deletedExperiences = [mockExperiences[1], mockExperiences[2]].map(e => ({ ...e, exploration_phase: DiveInPhase.PROCESSED }));

const meta: Meta<typeof RestoreExperiencesDrawer> = {
  title: "Experiences/RestoreExperiencesDrawer",
  component: RestoreExperiencesDrawer,
  tags: ["autodocs"],
  argTypes: {
    onClose: { action: "onClose" },
    onRestore: { action: "onRestore" },
    onExperiencesRestored: { action: "onExperiencesRestored" },
  },
};

export default meta;

const ServiceMockWrapper: React.FC<{ children: React.ReactNode; mock: () => Promise<any> }> = ({ children, mock }) => {
  ExperienceService.getInstance().getExperiences = mock;
  return <>{children}</>;
};

export const Default = {
  args: {
    isOpen: true,
    sessionId: 123,
    currentExperiences,
  },
  decorators: [
    (Story: React.FC) => {
      return (<ServiceMockWrapper mock={() => Promise.resolve([...currentExperiences, ...deletedExperiences])}>
          <Story />
        </ServiceMockWrapper>
      );
    }
  ],
};

export const Empty = {
  args: {
    isOpen: true,
    sessionId: 123,
    currentExperiences,
  },
  decorators: [
    (Story: React.FC) => (
      <ServiceMockWrapper mock={() => Promise.resolve(currentExperiences)}>
        <Story />
      </ServiceMockWrapper>
    ),
  ],
};

export const Loading = {
  args: {
    isOpen: true,
    sessionId: 123,
    currentExperiences,
  },
  decorators: [
    (Story: React.FC) => (
      <ServiceMockWrapper mock={() => new Promise(() => {})}>
        <Story />
      </ServiceMockWrapper>
    ),
  ],
}; 