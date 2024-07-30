import { Box, CircularProgress, TextField, useTheme } from "@mui/material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import React, { useState } from "react";

const uniqueId = "8ab76120-a0d3-47b1-aac0-42d0169e0a58";

export const DATA_TEST_ID = {
  FORM: `login-form-${uniqueId}`,
  EMAIL_INPUT: `login-email-input-${uniqueId}`,
  PASSWORD_INPUT: `login-password-input-${uniqueId}`,
  LOGIN_BUTTON: `login-button-${uniqueId}`,
  LOGIN_BUTTON_CIRCULAR_PROGRESS: `login-button-circular-progress-${uniqueId}`,
};

export interface LoginFormProps {
  notifyOnLogin: (email: string, password: string) => void;
  isLoggingIn: boolean;
}
const LoginWithEmailForm: React.FC<Readonly<LoginFormProps>> = ({ notifyOnLogin, isLoggingIn }) => {
  const theme = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const handleEmailChange = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setEmail(event.target.value);
  };
  const handlePasswordChange = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setPassword(event.target.value);
  };
  const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    notifyOnLogin(email, password);
  };
  return (
    <Box component="form" mt={2} onSubmit={handleLogin} data-testid={DATA_TEST_ID.FORM}>
      <TextField
        fullWidth
        label="Email"
        type="email"
        variant="outlined"
        margin="normal"
        disabled={isLoggingIn}
        required
        onChange={(e) => handleEmailChange(e)}
        inputProps={{ "data-testid": DATA_TEST_ID.EMAIL_INPUT }}
      />
      <TextField
        fullWidth
        label="Password"
        type="password"
        variant="outlined"
        disabled={isLoggingIn}
        margin="normal"
        required
        onChange={(e) => handlePasswordChange(e)}
        inputProps={{ "data-testid": DATA_TEST_ID.PASSWORD_INPUT }}
      />
      <PrimaryButton
        fullWidth
        variant="contained"
        color="primary"
        style={{ marginTop: 16 }}
        type="submit"
        disabled={isLoggingIn}
        disableWhenOffline={true}
        data-testid={DATA_TEST_ID.LOGIN_BUTTON}
      >
        {isLoggingIn ? (
          <CircularProgress
            color={"secondary"}
            data-testid={DATA_TEST_ID.LOGIN_BUTTON_CIRCULAR_PROGRESS}
            aria-label={"Logging in"}
            size={16}
            sx={{ marginTop: theme.tabiyaSpacing.sm, marginBottom: theme.tabiyaSpacing.sm }}
          />
        ) : (
          "Login"
        )}
      </PrimaryButton>
    </Box>
  );
};

export default LoginWithEmailForm;
