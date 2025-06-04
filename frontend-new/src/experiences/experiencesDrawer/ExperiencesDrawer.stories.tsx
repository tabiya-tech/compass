import { Meta } from "@storybook/react";
import ExperiencesDrawer from "src/experiences/experiencesDrawer/ExperiencesDrawer";
import { generateRandomExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";

const meta: Meta<typeof ExperiencesDrawer> = {
  title: "Experiences/ExperiencesDrawer",
  component: ExperiencesDrawer,
  tags: ["autodocs"],
  argTypes: {
    notifyOnClose: { action: "notifyOnClose" },
  },
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
