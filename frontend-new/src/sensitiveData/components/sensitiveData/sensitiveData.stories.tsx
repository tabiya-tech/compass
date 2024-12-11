import { Meta, StoryObj } from "@storybook/react";

import SensitiveData from "./SensitiveData";

const meta: Meta<typeof SensitiveData> = {
  title: "SensitiveData/SensitiveData",
  component: SensitiveData,
  tags: ["autodocs"],
};

export default meta;

export const Shown: StoryObj<typeof SensitiveData> = {
  args: {},
};
