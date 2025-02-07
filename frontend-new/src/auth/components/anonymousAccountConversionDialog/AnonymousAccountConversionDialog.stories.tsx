import { Meta, StoryObj } from "@storybook/react";
import AnonymousAccountConversionDialog from "./AnonymousAccountConversionDialog";
import { action } from "@storybook/addon-actions";

const meta: Meta<typeof AnonymousAccountConversionDialog> = {
  title: "Auth/AnonymousAccountConversionDialog",
  tags: ["autodocs"],
  component: AnonymousAccountConversionDialog,
};

export default meta;

export const Shown: StoryObj<typeof AnonymousAccountConversionDialog> = {
  args: {
    onClose: action("close"),
    onSuccess: action("success")
  },
};
