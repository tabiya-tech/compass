import { Meta, StoryObj } from "@storybook/react";
import Login from "./Login";
import { EnvVariables } from "src/envService";

const meta: Meta<typeof Login> = {
  title: "Auth/Login",
  tags: ["autodocs"],
  component: Login,
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

export const ShownAsEmptyField: StoryObj<typeof Login> = {
  args: {},
  parameters: {
    mockData: firebaseSuccessMock,
  },
};

export const ShownWithApplicationLoginCodeSet: StoryObj<typeof Login> = {
  args: {},
  parameters: {
    mockData: firebaseSuccessMock,
  },
  beforeEach: () => {
    window.tabiyaConfig[EnvVariables.FRONTEND_LOGIN_CODE] = btoa("bar");
    return () => {
      delete window.tabiyaConfig[EnvVariables.FRONTEND_LOGIN_CODE];
    };
  },
};

export const ShownWithDisabledApplicationLoginCode: StoryObj<typeof Login> = {
  args: {},
  parameters: {
    mockData: firebaseSuccessMock,
  },
  beforeEach: () => {
    window.tabiyaConfig[EnvVariables.FRONTEND_DISABLE_LOGIN_CODE] = btoa("true");
    return () => {
      delete window.tabiyaConfig[EnvVariables.FRONTEND_DISABLE_LOGIN_CODE];
    };
  },
};
