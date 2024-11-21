import { Meta, StoryObj } from "@storybook/react";

import SensitiveDataForm from "./SensitiveDataForm";

const meta: Meta<typeof SensitiveDataForm> = {
  title: "SensitiveDataForm/SensitiveDataForm",
  component: SensitiveDataForm,
  tags: ["autodocs"],
};

export default meta;

export const Shown: StoryObj<typeof SensitiveDataForm> = {
  args: {},
};
