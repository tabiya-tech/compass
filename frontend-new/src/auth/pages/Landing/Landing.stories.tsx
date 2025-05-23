import { Meta, StoryObj } from "@storybook/react";
import Landing from "src/auth/pages/Landing/Landing";
import { EnvVariables } from "src/envService";
import FirebaseInvitationCodeAuthenticationService from "src/auth/services/FirebaseAuthenticationService/invitationCodeAuth/FirebaseInvitationCodeAuthenticationService";

interface StoryArgs {
  loginCode?: string;
}

const meta: Meta<typeof Landing> = {
  title: "Auth/Landing",
  component: Landing,
  tags: ["autodocs"],
  decorators: [
    (Story, context) => {
      const { loginCode } = context.args as StoryArgs;
      (window as any).tabiyaConfig = {
        ...(window as any).tabiyaConfig,
        [EnvVariables.FRONTEND_LOGIN_CODE]: loginCode ? window.btoa(loginCode) : "",
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

export const WithApplicationInvitationCode: Story = {
  args: {
    loginCode: "test-invitation-code",
  },
};

export const WithoutApplicationInvitationCode: Story = {
  args: {
    loginCode: "",
  },
};
