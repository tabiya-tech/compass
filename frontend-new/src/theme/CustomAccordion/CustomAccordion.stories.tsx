import CustomAccordion from "src/theme/CustomAccordion/CustomAccordion";
import { Meta, type StoryObj } from "@storybook/react";

const meta: Meta<typeof CustomAccordion> = {
  title: "Components/CustomAccordion",
  component: CustomAccordion,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof CustomAccordion>;

export const Shown: Story = {
  args: {
    title: "User Information",
    tooltipText: "This section contains user details",
    children: (
      <div>
        <p>Name: John Doe</p>
        <p>Email: john.doe@example.com</p>
      </div>
    ),
  },
};
