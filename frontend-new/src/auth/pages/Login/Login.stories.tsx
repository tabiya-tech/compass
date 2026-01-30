import { Meta, StoryObj } from "@storybook/react";
import Login from "./Login";
import { EnvVariables } from "src/envService";

interface StoryArgs {
  loginCode?: string;
  registrationDisabled?: boolean;
  loginCodeDisabled?: boolean;
  socialAuthDisabled?: boolean;
}

const meta: Meta<typeof Login> = {
  title: "Auth/Login",
  tags: ["autodocs"],
  component: Login,
  decorators: [
    (Story, context) => {
      const { loginCode, registrationDisabled, loginCodeDisabled, socialAuthDisabled } = context.args as StoryArgs;
      (window as any).tabiyaConfig = {
        ...(window as any).tabiyaConfig,
        [EnvVariables.FRONTEND_LOGIN_CODE]: loginCode ? window.btoa(loginCode) : "",
        [EnvVariables.FRONTEND_DISABLE_REGISTRATION]: registrationDisabled ? window.btoa("true") : window.btoa("false"),
        [EnvVariables.GLOBAL_DISABLE_LOGIN_CODE]: loginCodeDisabled ? window.btoa("true") : window.btoa("false"),
        [EnvVariables.FRONTEND_DISABLE_SOCIAL_AUTH]: socialAuthDisabled ? window.btoa("true") : window.btoa("false"),
      };

      return <Story />;
    },
  ],
};

const firebaseSuccessMock = [
  {
    url: "https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=AIzaSyADoRJBGzpi9i1PFAhhXDzhqlA_l_Luz5I",
    method: "POST",
    status: 200,
    response: {},
  },
];

export default meta;

export const Default: StoryObj<typeof Login> = {
  args: {
    loginCode: "",
    registrationDisabled: false,
    loginCodeDisabled: false,
  },
  parameters: {
    mockData: firebaseSuccessMock,
  },
};

export const WithApplicationLoginCode: StoryObj<typeof Login> = {
  args: {
    loginCode: "test-login-code",
    registrationDisabled: false,
    loginCodeDisabled: false,
  },
  parameters: {
    mockData: firebaseSuccessMock,
  },
};

export const WithLoginCodeDisabled: StoryObj<typeof Login> = {
  args: {
    loginCode: "",
    registrationDisabled: false,
    loginCodeDisabled: true,
  },
  parameters: {
    mockData: firebaseSuccessMock,
  },
};

export const WithRegistrationDisabled: StoryObj<typeof Login> = {
  args: {
    loginCode: "",
    registrationDisabled: true,
    loginCodeDisabled: false,
  },
  parameters: {
    mockData: firebaseSuccessMock,
  },
};

export const WithRegistrationDisabledAndLoginCodeDisabled: StoryObj<typeof Login> = {
  args: {
    loginCode: "",
    registrationDisabled: true,
    loginCodeDisabled: true,
  },
  parameters: {
    mockData: firebaseSuccessMock,
  },
};

export const WithApplicationLoginCodeAndRegistrationDisabled: StoryObj<typeof Login> = {
  args: {
    loginCode: "test-login-code",
    registrationDisabled: true,
    loginCodeDisabled: false,
  },
  parameters: {
    mockData: firebaseSuccessMock,
  },
};

export const WithSocialAuthDisabled: StoryObj<typeof Login> = {
  args: {
    socialAuthDisabled: true,
  },
  parameters: {
    mockData: firebaseSuccessMock,
  },
};
