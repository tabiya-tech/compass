import { Box, CircularProgress, TextField, useTheme } from "@mui/material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import React, { useState } from "react";
import { validatePassword } from "src/auth/utils/validatePassword";

const uniqueId = "6cf1a0fa-8d75-4342-bf6b-1203d5b114d7";

export const DATA_TEST_ID = {
  FORM: `register-form-${uniqueId}`,
  NAME_INPUT: `register-name-input-${uniqueId}`,
  EMAIL_INPUT: `register-email-input-${uniqueId}`,
  PASSWORD_INPUT: `register-password-input-${uniqueId}`,
  REGISTER_BUTTON: `register-button-${uniqueId}`,
  REGISTER_BUTTON_CIRCULAR_PROGRESS: `register-button-circular-progress-${uniqueId}`,
};

export interface RegisterFormProps {
  notifyOnRegister: (name: string, email: string, password: string) => void;
  isRegistering: boolean;
}

const RegisterWithEmailForm: React.FC<Readonly<RegisterFormProps>> = ({ notifyOnRegister, isRegistering }) => {
  const theme = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string>("");

  const handleNameChange = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setName(event.target.value);
  };
  const handleEmailChange = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setEmail(event.target.value);
  };
  const handlePasswordChange = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  const handleRegister = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const passwordValidationResult = validatePassword(password);
    setPasswordError(passwordValidationResult);

    if (passwordValidationResult === "") {
      notifyOnRegister(name, email, password);
    }
  };
  return (
    <Box component="form" mt={2} onSubmit={handleRegister} data-testid={DATA_TEST_ID.FORM}>
      <TextField
        fullWidth
        label="Name"
        variant="outlined"
        margin="normal"
        disabled={isRegistering}
        required
        onChange={(e) => handleNameChange(e)}
        inputProps={{ "data-testid": DATA_TEST_ID.NAME_INPUT }}
      />
      <TextField
        fullWidth
        label="Email"
        type="email"
        disabled={isRegistering}
        variant="outlined"
        margin="normal"
        required
        onChange={(e) => handleEmailChange(e)}
        inputProps={{ "data-testid": DATA_TEST_ID.EMAIL_INPUT }}
      />
      <TextField
        fullWidth
        label="Password"
        type="password"
        disabled={isRegistering}
        variant="outlined"
        margin="normal"
        required
        onChange={(e) => handlePasswordChange(e)}
        inputProps={{ "data-testid": DATA_TEST_ID.PASSWORD_INPUT }}
        error={!!passwordError}
        helperText={passwordError}
      />
      <PrimaryButton
        fullWidth
        variant="contained"
        color="primary"
        style={{ marginTop: 16 }}
        type="submit"
        disabled={isRegistering}
        disableWhenOffline={true}
        data-testid={DATA_TEST_ID.REGISTER_BUTTON}
      >
        {isRegistering ? (
          <CircularProgress
            color={"secondary"}
            aria-label={"Registering"}
            data-testid={DATA_TEST_ID.REGISTER_BUTTON_CIRCULAR_PROGRESS}
            size={16}
            sx={{ marginTop: theme.tabiyaSpacing.sm, marginBottom: theme.tabiyaSpacing.sm }}
          />
        ) : (
          "Register"
        )}
      </PrimaryButton>
    </Box>
  );
};

export default RegisterWithEmailForm;
