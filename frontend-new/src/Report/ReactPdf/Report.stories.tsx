import Report from "src/Report/ReactPdf/Report";
import { Meta, type StoryObj } from "@storybook/react";
import { generateRandomExperiences } from "src/Experiences/ExperienceService/_test_utilities/mockExperiencesResponses";

const meta: Meta<typeof Report> = {
  title: "Report/Report",
  component: Report,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof Report>;

export const Shown: Story = {
  args: {
    name: "John Doe",
    email: "example@mail.com",
    phone: "1234567890",
    address: "1234 Main St",
    experiences: generateRandomExperiences(3),
    conversationCompletedAt: "2021-06-01T00:00:00Z",
  },
};

export const ShownWithNoPersonalInfo: Story = {
  args: {
    name: "",
    email: "",
    phone: "",
    address: "",
    experiences: generateRandomExperiences(3),
    conversationCompletedAt: "2021-06-01T00:00:00Z",
  },
};

export const ShownWithSomePersonalInfo: Story = {
  args: {
    name: "John Doe",
    email: "example@mail.com",
    phone: "",
    address: "",
    experiences: generateRandomExperiences(3),
    conversationCompletedAt: "2021-06-01T00:00:00Z",
  },
};
