import { Meta, StoryObj } from "@storybook/react";
import ConfirmModalDialog from "src/theme/confirmModalDialog/ConfirmModalDialog";
import { GoogleIcon } from "src/theme/Icons/GoogleIcon";
import { Checkbox } from "@mui/material";
import React from "react";

const meta: Meta<typeof ConfirmModalDialog> = {
  title: "Components/ConfirmModalDialog",
  component: ConfirmModalDialog,
  tags: ["autodocs"],
  argTypes: {
    onConfirm: { action: "onConfirm" },
    onCancel: { action: "onCancel" },
    onDismiss: { action: "onDismiss" },
  },
};

export default meta;

type Story = StoryObj<typeof ConfirmModalDialog>;

export const Shown: Story = {
  args: {
    title: "Sample Title",
    content: (
      <>
        This is a sample body text for the ConfirmModal component.
        <br />
        <br />
        Please confirm your action.
      </>
    ),
    isOpen: true,
    cancelButtonText: "Cancel",
    confirmButtonText: "Confirm",
  },
};

export const ShownWithCloseIcon: Story = {
  args: {
    title: "Sample Title",
    content: (
      <>
        This is a sample body text for the ConfirmModal component.
        <br />
        <br />
        Please confirm your action.
      </>
    ),
    isOpen: true,
    cancelButtonText: "Cancel",
    confirmButtonText: "Confirm",
    showCloseIcon: true,
  },
};

export const ShownWithComplexBody: Story = {
  args: {
    title: "Sample Title",
    content: (
      <>
        This is a sample body text for the ConfirmModal component.
        <br />
        <br />
        <GoogleIcon /> Google Icon
        <br />
        <Checkbox
          checked={true}
          onChange={() => {}}
          sx={{ padding: 0, marginTop: 0.5, transform: "scale(1.3)" }}
          inputProps={{ "aria-label": "Checkbox1" }}
        />{" "}
        Checked
        <br />
        <Checkbox
          checked={false}
          onChange={() => {}}
          sx={{ padding: 0, marginTop: 0.5, transform: "scale(1.3)" }}
          inputProps={{ "aria-label": "Checkbox2" }}
        />{" "}
        Unchecked
        <br />
        <br />
        List of items
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
          <li>Item 3</li>
        </ul>
      </>
    ),
    isOpen: true,
    cancelButtonText: "Cancel",
    confirmButtonText: "Confirm",
  },
};
