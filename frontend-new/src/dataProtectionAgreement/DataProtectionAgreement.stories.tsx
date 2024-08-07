import { Meta, StoryObj } from "@storybook/react";
import DataProtectionAgreement from "./DataProtectionAgreement";

const meta: Meta<typeof DataProtectionAgreement> = {
  title: "Auth/DataProtectionAgreement",
  tags: ["autodocs"],
  component: DataProtectionAgreement,
};

export default meta;

export const Shown: StoryObj<typeof DataProtectionAgreement> = {
  args: {},
};

export const AcceptingDPA: StoryObj<typeof DataProtectionAgreement> = {
  args: {
    isLoading: true,
  },
};
