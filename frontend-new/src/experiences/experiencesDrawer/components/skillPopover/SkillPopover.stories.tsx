import { Meta, type StoryObj } from "@storybook/react";
import SkillPopover from "./SkillPopover";
import { generateRandomExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";

const meta: Meta<typeof SkillPopover> = {
  title: "Experiences/SkillPopover",
  component: SkillPopover,
  tags: ["autodocs"],
  argTypes: {
    open: {
      control: {
        type: "boolean",
      },
    },
    onClose: {
      action: "onClose",
    },
  },
};
export default meta;

type Story = StoryObj<typeof SkillPopover>;

const centeredDiv = document.createElement("div");
centeredDiv.style.position = "fixed";
centeredDiv.style.top = "50%";
centeredDiv.style.left = "50%";
document.body.appendChild(centeredDiv);

export const Shown: Story = {
  args: {
    open: true,
    anchorEl: centeredDiv,
    onClose: () => {},
    skill: generateRandomExperiences(1)[0].top_skills[0],
  },
};
