import ExperiencesContent from "./ExperiencesReportContent";
import { Meta, StoryObj } from "@storybook/react";
import { generateRandomExperiences } from "src/Experiences/ExperienceService/_test_utilities/mockExperiencesResponses";

const meta: Meta<typeof ExperiencesContent> = {
  title: "Report/ExperiencesContent",
  component: ExperiencesContent,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof ExperiencesContent>;

export const Shown: Story = {
  args: {
    experience: generateRandomExperiences(1)[0],
  },
};
