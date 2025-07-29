import { Meta, StoryObj } from "@storybook/react";
import Landing from "src/auth/pages/Landing/Landing";
import { EnvVariables } from "src/envService";
import FirebaseInvitationCodeAuthenticationService from "src/auth/services/FirebaseAuthenticationService/invitationCodeAuth/FirebaseInvitationCodeAuthenticationService";

interface StoryArgs {
  loginCode?: string;
  registrationDisabled?: boolean;
  loginCodeDisabled?: boolean;
}

const meta: Meta<typeof Landing> = {
  title: "Auth/Landing",
  component: Landing,
  tags: ["autodocs"],
  decorators: [
    (Story, context) => {
      const { loginCode, registrationDisabled, loginCodeDisabled } = context.args as StoryArgs;
      (window as any).tabiyaConfig = {
        ...(window as any).tabiyaConfig,
        [EnvVariables.FRONTEND_LOGIN_CODE]: loginCode ? window.btoa(loginCode) : "",
        [EnvVariables.FRONTEND_DISABLE_REGISTRATION]: registrationDisabled ? window.btoa("true") : window.btoa("false"),
        [EnvVariables.FRONTEND_DISABLE_LOGIN_CODE]: loginCodeDisabled ? window.btoa("true") : window.btoa("false"),
      };

      FirebaseInvitationCodeAuthenticationService.getInstance = () =>
        ({
          login: async () => Promise.resolve(),
        }) as any;

      return <Story />;
    },
  ],
};

export default meta;

type Story = StoryObj<typeof Landing>;

export const WithGuestLoginEnabled: Story = {
  args: {
    loginCode: "test-invitation-code",
    registrationDisabled: false,
  },
};

export const WithGuestLoginDisabled: Story = {
  args: {
    loginCode: "",
    registrationDisabled: false,
  },
};

export const WithRegistrationDisabled: Story = {
  args: {
    loginCode: "",
    registrationDisabled: true,
  },
};

export const WithRegistrationDisabledAndGuestLoginEnabled: Story = {
  args: {
    loginCode: "test-invitation-code",
    registrationDisabled: true,
    loginCodeDisabled: false,
  },
};
