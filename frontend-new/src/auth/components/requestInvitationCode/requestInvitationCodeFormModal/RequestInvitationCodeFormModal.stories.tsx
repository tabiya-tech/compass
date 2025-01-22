import { Meta, StoryObj } from "@storybook/react";
import RequestInvitationCodeFormModal from "src/auth/components/requestInvitationCode/requestInvitationCodeFormModal/RequestInvitationCodeFormModal";

const meta: Meta<typeof RequestInvitationCodeFormModal> = {
  title: "Invitations/RequestInvitationCodeFormModal",
  component: RequestInvitationCodeFormModal,
  tags: ["autodocs"],
  argTypes: {
    onClose: { action: "close" },
  },
};

export default meta;

type Story = StoryObj<typeof RequestInvitationCodeFormModal>;

export const Shown: Story = {
  args: {
    open: true,
  },
};
