import { Meta, StoryObj } from "@storybook/react";
import IDPAuth from "./IDPAuth";

const meta: Meta<typeof IDPAuth> = {
  title: "Auth/IDPAuth",
  tags: ["autodocs"],
  component: IDPAuth,
};

export default meta;

export const Shown: StoryObj<typeof IDPAuth> = {
  args: {},
};
