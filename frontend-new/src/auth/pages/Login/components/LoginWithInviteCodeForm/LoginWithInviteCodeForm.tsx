import { TextField } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

const uniqueId = "300d373e-b913-4bd5-9045-3a28d490cf2c";

export const DATA_TEST_ID = {
  FORM: `login-form-${uniqueId}`,
  CODE_INPUT: `login-inviteCode-input-${uniqueId}`,
  LOGIN_BUTTON: `login-button-${uniqueId}`,
  LOGIN_BUTTON_CIRCULAR_PROGRESS: `login-button-circular-progress-${uniqueId}`,
};

export interface LoginFormProps {
  inviteCode: string;
  notifyOnInviteCodeChanged: (inviteCode: string) => void;
  isDisabled: boolean;
}
const LoginWithInviteCodeForm: React.FC<Readonly<LoginFormProps>> = ({
  inviteCode,
  notifyOnInviteCodeChanged,
  isDisabled,
}) => {

  const { t } = useTranslation();

  const handleInviteCodeChange = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    event.preventDefault();
    notifyOnInviteCodeChanged(event.target.value);
  };

  return (
    <TextField
      fullWidth
      label={t("auth.pages.login.components.loginWithInviteCodeForm.loginCode")}
      variant="outlined"
      value={inviteCode}
      disabled={isDisabled}
      onChange={(e) => handleInviteCodeChange(e)}
      inputProps={{ "data-testid": DATA_TEST_ID.CODE_INPUT }}
    />
  );
};

export default LoginWithInviteCodeForm;
