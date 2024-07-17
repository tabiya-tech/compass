import { Meta } from "@storybook/react";
import ExperiencesDrawerContent from "src/Experiences/components/ExperiencesDrawerContent/ExperiencesDrawerContent";
import { generateRandomExperiences } from "src/Experiences/ExperienceService/_test_utilities/mockExperiencesResponses";

const meta: Meta<typeof ExperiencesDrawerContent> = {
  title: "Experiences/ExperiencesDrawerContent",
  component: ExperiencesDrawerContent,
  tags: ["autodocs"],
};

export default meta;

export const Shown = {
  args: {
    experience: generateRandomExperiences(1)[0],
  },
};
