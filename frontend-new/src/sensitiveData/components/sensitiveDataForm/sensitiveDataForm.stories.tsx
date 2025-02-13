import { Meta, StoryObj } from "@storybook/react";

import SensitiveDataForm from "src/sensitiveData/components/sensitiveDataForm/SensitiveDataForm";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import {
  Language,
  SensitivePersonalDataRequirement,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { getBackendUrl } from "src/envService";

const meta: Meta<typeof SensitiveDataForm> = {
  title: "SensitiveDataForm/SensitiveDataForm",
  component: SensitiveDataForm,
  tags: ["autodocs"],
  parameters: {
    mockData: [
      {
        url: `${getBackendUrl()}/users/foo/sensitive-personal-data`,
        method: "POST",
        status: 201,
        response: {
          data: "",
        },
      },
    ],
  },
};

export default meta;

export const Shown: StoryObj<typeof SensitiveDataForm> = {
  beforeEach: () => {
    UserPreferencesStateService.getInstance().setUserPreferences({
      user_id: "foo",
      has_sensitive_personal_data: false,
      accepted_tc: new Date(),
      sessions: [],
      sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
      sessions_with_feedback: [],
      language: Language.en,
    });
    return () => {
      UserPreferencesStateService.getInstance().clearUserPreferences();
    };
  },
  args: {},
};

export const ShownWhenSkipping: StoryObj<typeof SensitiveDataForm> = {
  beforeEach: () => {
    UserPreferencesStateService.getInstance().setUserPreferences({
      user_id: "foo",
      has_sensitive_personal_data: false,
      accepted_tc: new Date(),
      sessions: [],
      sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
      sessions_with_feedback: [],
      language: Language.en,
    });
    return () => {
      UserPreferencesStateService.getInstance().clearUserPreferences();
    };
  },
  args: {},
};
