import { Meta, StoryObj } from "@storybook/react";
import AuthHeader from "./AuthHeader";

const meta: Meta<typeof AuthHeader> = {
  title: "Auth/AuthHeader",
  component: AuthHeader,
  tags: ["autodocs"],
};

export default meta;

export const Shown: StoryObj<typeof AuthHeader> = {
  args: {
    title: "Test title",
    subtitle: <>Test subtitle</>,
  },
};
