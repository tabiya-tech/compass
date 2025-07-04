import { Meta } from "@storybook/react";
import ExperiencesDrawer from "src/experiences/experiencesDrawer/ExperiencesDrawer";
import { generateRandomExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";
import { DiveInPhase } from "src/experiences/experienceService/experiences.types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import ExperienceService from "src/experiences/experienceService/experienceService";

const meta: Meta<typeof ExperiencesDrawer> = {
  title: "Experiences/ExperiencesDrawer",
  component: ExperiencesDrawer,
  tags: ["autodocs"],
  argTypes: {
    notifyOnClose: { action: "notifyOnClose" },
  },
  decorators: [
    (Story) => {
      // Mock AuthenticationStateService
      const mockUserPreferencesStateService = UserPreferencesStateService.getInstance();
      mockUserPreferencesStateService.getActiveSessionId = () => 1234;

      const mockExperienceService = {
        getOriginalExperience: () => ({
          uuid: "1234",
          summary: "This is the original summary of the experience.".repeat(15),
        }),
        updateExperience: (sessionId: number, experience_uuid: string, data: {summary: string}) => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ...data,
                uuid: experience_uuid,
              });
            }, 1000);
          });
        },
      };
      // @ts-ignore
      ExperienceService.getInstance().getUneditedExperience = mockExperienceService.getOriginalExperience;
      // @ts-ignore
      ExperienceService.getInstance().updateExperience = mockExperienceService.updateExperience;

      return <Story/>
    }]
};

export default meta;

export const Shown = {
  args: {
    isOpen: true,
    experiences: generateRandomExperiences(3),
  },
};

export const ShownWhenLoading = {
  args: {
    isOpen: true,
    isLoading: true,
    experiences: generateRandomExperiences(3),
  },
};

export const ShownWithSingleExperience = {
  args: {
    isOpen: true,
    experiences: generateRandomExperiences(1),
  },
};

export const ShownWithMultipleExperiences = {
  args: {
    isOpen: true,
    experiences: generateRandomExperiences(5),
  },
};

export const ShownWithNoExperiences = {
  args: {
    isOpen: true,
    experiences: [],
  },
};

const ShownWithNoExperienceTitle_experiences = generateRandomExperiences(1);
ShownWithNoExperienceTitle_experiences.forEach((experience) => {
  experience.experience_title = "";
  experience.top_skills = [];
});
export const ShownWithNoExperienceTitle = {
  args: {
    isOpen: true,
    experiences: ShownWithNoExperienceTitle_experiences,
  },
};

const ShownWithExperienceWithEmptySkills_experiences = generateRandomExperiences(1);
ShownWithExperienceWithEmptySkills_experiences.forEach((experience) => (experience.top_skills = []));
export const ShownWithExperienceWithEmptySkills = {
  args: {
    isOpen: true,
    experiences: ShownWithExperienceWithEmptySkills_experiences,
  },
};

export const ShownWhenConversationCompleted = {
  args: {
    isOpen: true,
    experiences: generateRandomExperiences(3),
    conversationCompleted: true,
  },
};

const ShownWithUncategorized_experiences = generateRandomExperiences(1);
ShownWithUncategorized_experiences.forEach((experience) => {
  experience.work_type = null;
});
export const ShownWithUncategorizedExperiences = {
  args: {
    isOpen: true,
    experiences: ShownWithUncategorized_experiences,
    conversationCompleted: true,
  },
};

const ShownWithNoSummary_experiences = generateRandomExperiences(1);
ShownWithNoSummary_experiences.forEach((experience) => {
  experience.summary = "";
});

export const ShownWithNoSummary = {
  args: {
    isOpen: true,
    experiences: ShownWithNoSummary_experiences,
  },
};

const ShownWhenAllExperiencesExplored_experiences = generateRandomExperiences(3);
ShownWhenAllExperiencesExplored_experiences.forEach(experience =>  {
  experience.exploration_phase = DiveInPhase.PROCESSED;
})

export const ShownWhenAllExperiencesExplored = {
  args: {
    isOpen: true,
    experiences: ShownWhenAllExperiencesExplored_experiences,
  },
};

export const ShownWithRestoreDrawerOpen = {
  args: {
    isOpen: true,
    experiences: generateRandomExperiences(2),
  },
  parameters: {
    msw: {
      handlers: [
        {
          method: "get",
          url: "/api/experiences",
          response: generateRandomExperiences(4), // 2 current, 2 deleted
        },
      ],
    },
  },
};