import type { Meta, StoryObj } from "@storybook/react";

import InlineEditField from "src/theme/InlineEditField/InlineEditField";

const meta: Meta<typeof InlineEditField> = {
  title: "Components/InlineEditField",
  component: InlineEditField,
  tags: ["autodocs"],
  args: {
    placeholder: "Click to edit",
    sx: { width: "20%" },
    "data-testid": "foo-testid",
  },
};

export default meta;
type Story = StoryObj<typeof InlineEditField>;

export const Shown: Story = {
  args: {
    placeholder: "Click to edit",
  },
};

export const Edited: Story = {
  args: {
    placeholder: "This field is edited already",
    disabled: false,
    showEditBadge: true,
  },
};

export const ShownAsTextArea: Story = {
  args: {
    placeholder: "Click to edit",
    multiline: true,
    minRows: 4,
  },
};

export const Disabled: Story = {
  args: {
    placeholder: "Click to edit",
    disabled: true,
  },
};
