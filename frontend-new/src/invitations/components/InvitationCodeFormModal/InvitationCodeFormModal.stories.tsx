import { Meta, type StoryObj } from '@storybook/react';
import InvitationCodeFormModal from 'src/invitations/components/InvitationCodeFormModal/InvitationCodeFormModal';

const meta: Meta<typeof InvitationCodeFormModal> = {
  title: "Invitations/InvitationCodeFormModal",
  component: InvitationCodeFormModal,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof InvitationCodeFormModal>;

export const Shown: Story = {
  args: {
    show: true,
    onClose: () => {},
  },
};

export const Hidden: Story = {
  args: {
    show: false,
    onClose: () => {},
  },
}
