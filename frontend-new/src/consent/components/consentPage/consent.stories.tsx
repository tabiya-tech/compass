import { Meta, StoryObj } from "@storybook/react";
import Consent from "./Consent";

const meta: Meta<typeof Consent> = {
  title: "Auth/Consent",
  tags: ["autodocs"],
  component: Consent,
};

export default meta;

export const Shown: StoryObj<typeof Consent> = {
  args: {},
};
