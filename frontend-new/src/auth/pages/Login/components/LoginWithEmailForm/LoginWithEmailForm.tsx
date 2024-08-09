import { Box, TextField, useTheme } from "@mui/material";
import React from "react";

const uniqueId = "8ab76120-a0d3-47b1-aac0-42d0169e0a58";

export const DATA_TEST_ID = {
  EMAIL_LOGIN_FORM_CONTAINER: `login-form-${uniqueId}`,
  EMAIL_LOGIN_FORM_EMAIL_INPUT: `login-email-input-${uniqueId}`,
  EMAIL_LOGIN_FORM_PASSWORD_INPUT: `login-password-input-${uniqueId}`,
};

export interface LoginFormProps {
  email: string;
  password: string;
  passwordError: string;
  notifyOnEmailChanged: (email: string) => void;
  notifyOnPasswordChanged: (password: string) => void;
  notifyOnFocused: () => void;
  isDisabled: boolean;
}
const LoginWithEmailForm: React.FC<Readonly<LoginFormProps>> = ({
  email,
  password,
  passwordError,
  notifyOnEmailChanged,
  notifyOnPasswordChanged,
  isDisabled,
}) => {
  const theme = useTheme();
  const handleEmailChange = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    event.preventDefault();
    notifyOnEmailChanged(event.target.value);
  };
  const handlePasswordChange = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    event.preventDefault();
    notifyOnPasswordChanged(event.target.value);
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      width={"100%"}
      justifyContent={"space-evenly"}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
      data-testid={DATA_TEST_ID.EMAIL_LOGIN_FORM_CONTAINER}
    >
      <TextField
        fullWidth
        label="Email"
        type="email"
        variant="outlined"
        disabled={isDisabled}
        value={email}
        onChange={(e) => handleEmailChange(e)}
        inputProps={{ "data-testid": DATA_TEST_ID.EMAIL_LOGIN_FORM_EMAIL_INPUT }}
      />
      <TextField
        fullWidth
        label="Password"
        type="password"
        variant="outlined"
        disabled={isDisabled}
        value={password}
        onChange={(e) => handlePasswordChange(e)}
        inputProps={{ "data-testid": DATA_TEST_ID.EMAIL_LOGIN_FORM_PASSWORD_INPUT }}
        error={!!passwordError}
        helperText={passwordError}
      />
    </Box>
  );
};

export default LoginWithEmailForm;
