import { Meta, type StoryObj } from "@storybook/react";
import RegistrationCodeFormModal, {
  RegistrationCodeFormModalState,
} from "src/invitations/components/RegistrationCodeFormModal/RegistrationCodeFormModal";

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
    modalState: RegistrationCodeFormModalState.SHOW,
  },
};

export const Hidden: Story = {
  args: {
    modalState: RegistrationCodeFormModalState.HIDE,
  },
};
