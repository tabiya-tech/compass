import { Meta, StoryObj } from "@storybook/react";
import DataProtectionAgreement from "./DataProtectionPolicy";

const meta: Meta<typeof DataProtectionAgreement> = {
  title: "Auth/DataProtectionAgreement",
  tags: ["autodocs"],
  component: DataProtectionAgreement,
};

export default meta;

export const Shown: StoryObj<typeof DataProtectionAgreement> = {
  args: {},
};
