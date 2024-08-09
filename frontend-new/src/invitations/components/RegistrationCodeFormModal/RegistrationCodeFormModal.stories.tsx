import { Meta, type StoryObj } from "@storybook/react";
import RegistrationCodeFormModal from "src/invitations/components/RegistrationCodeFormModal/RegistrationCodeFormModal";

const meta: Meta<typeof RegistrationCodeFormModal> = {
  title: "Invitations/RegistrationCodeFormModal",
  component: RegistrationCodeFormModal,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof RegistrationCodeFormModal>;

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
};
