import { Meta } from "@storybook/react";
import ExperiencesDrawer from "src/Experiences/ExperiencesDrawer";
import { generateRandomExperiences } from "src/Experiences/ExperienceService/_test_utilities/mockExperiencesResponses";

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

const ShownWithExperienceWithEmptySkills_experiences = generateRandomExperiences(1);
ShownWithExperienceWithEmptySkills_experiences[0].top_skills = [];
export const ShownWithExperienceWithEmptySkills = {
  args: {
    isOpen: true,
    experiences: ShownWithExperienceWithEmptySkills_experiences,
  },
};
