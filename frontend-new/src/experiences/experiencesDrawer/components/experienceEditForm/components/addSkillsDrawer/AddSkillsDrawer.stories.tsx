import { faker } from "@faker-js/faker";
import { Meta, StoryObj } from "@storybook/react";
import { generateRandomExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";
import AddSkillsDrawer from "src/experiences/experiencesDrawer/components/experienceEditForm/components/addSkillsDrawer/AddSkillsDrawer";

const meta: Meta<typeof AddSkillsDrawer> = {
  title: "Experiences/ExperienceEditForm/AddSkillsDrawer",
  component: AddSkillsDrawer,
  tags: ["autodocs"],
  argTypes: {
    onAddSkill: { action: "onAddSkill" },
    onClose: { action: "onClose" },
  },
};
export default meta;

type Story = StoryObj<typeof AddSkillsDrawer>;

export const Shown: Story = {
  args: {
    skills: generateRandomExperiences(2)[0].top_skills,
  },
};

export const ShownWithLongDescription: StoryObj = {
  args: {
    skills: [
      {
        UUID: faker.string.uuid(),
        preferredLabel: faker.company.catchPhrase(),
        description: faker.lorem.paragraphs(3, "\n"),
        altLabels: Array.from({ length: 8 }, () => faker.company.catchPhrase()),
      },
    ],
  },
};

export const ShownWithManyAltLabels: StoryObj = {
  args: {
    skills: [
      {
        UUID: faker.string.uuid(),
        preferredLabel: faker.company.catchPhrase(),
        description: faker.lorem.paragraph(3),
        altLabels: Array.from({ length: 15 }, () => faker.company.catchPhrase()),
      },
    ],
  },
};
