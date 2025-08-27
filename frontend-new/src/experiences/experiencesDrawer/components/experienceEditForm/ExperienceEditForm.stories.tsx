import { Meta } from "@storybook/react/*";
import ExperienceEditForm, {
  DeletableSkill,
} from "src/experiences/experiencesDrawer/components/experienceEditForm/ExperienceEditForm";
import { generateRandomExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";
import {
  EXPERIENCE_TITLE_MAX_LENGTH,
  COMPANY_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  SUMMARY_MAX_LENGTH,
  TIMELINE_MAX_LENGTH,
} from "src/experiences/experienceService/experiences.types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import ExperienceService from "src/experiences/experienceService/experienceService";
import { faker } from "@faker-js/faker";

const meta: Meta<typeof ExperienceEditForm> = {
  title: "Experiences/ExperienceEditForm",
  component: ExperienceEditForm,
  tags: ["autodocs"],
  argTypes: {
    notifyOnSave: { action: "saved" },
    notifyOnCancel: { action: "cancel" },
    notifyOnUnsavedChange: { action: "unsavedChangesChanged" },
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
        updateExperience: (sessionId: number, experience_uuid: string, data: { summary: string }) => {
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

      return <Story />;
    },
  ],
};

export default meta;

type Story = Meta<typeof ExperienceEditForm>;

export const Shown: Story = {
  args: {
    experience: generateRandomExperiences(2)[0],
  },
};

export const FieldOverflowError: Story = {
  args: {
    experience: {
      ...generateRandomExperiences(1)[0],
      experience_title: "x".repeat(EXPERIENCE_TITLE_MAX_LENGTH + 5),
      company: "y".repeat(COMPANY_MAX_LENGTH + 5),
      location: "z".repeat(LOCATION_MAX_LENGTH + 5),
      summary: "s".repeat(SUMMARY_MAX_LENGTH + 5),
      timeline: {
        start: "s".repeat(TIMELINE_MAX_LENGTH + 5),
        end: "e".repeat(TIMELINE_MAX_LENGTH + 5),
      },
    },
  },
};

export const ShownWithNewAddedSkills: Story = {
  args: {
    experience: {
      ...generateRandomExperiences(1)[0],
      top_skills: [
        {
          UUID: "skill-1",
          preferredLabel: "Order supplies",
          description: "Ability to manage and order supplies efficiently",
          altLabels: ["Supply Management", "Inventory Control"],
          orderIndex: 0,
          newlyAdded: true,
        } as DeletableSkill,
        {
          UUID: "skill-2",
          preferredLabel: "Apply health and safety standards",
          description: "Knowledge of health and safety standards in the workplace",
          altLabels: ["Health Standards", "Safety Regulations"],
          orderIndex: 1,
          newlyAdded: true,
        } as DeletableSkill,
        ...(generateRandomExperiences(1)[0].top_skills || []),
      ],
    },
  },
};

export const ShownWithLongSkillLabel: Story = {
  args: {
    experience: {
      ...generateRandomExperiences(1)[0],
      top_skills: Array.from({ length: 5 }, (_, index) => ({
        UUID: faker.string.uuid(),
        preferredLabel: faker.lorem.sentence(8),
        description: faker.lorem.paragraph(3),
        altLabels: Array.from({ length: 3 }, () => faker.lorem.words(3)),
        orderIndex: index,
      })),
    },
  },
};
