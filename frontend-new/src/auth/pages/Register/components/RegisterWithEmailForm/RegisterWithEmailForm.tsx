import { Box, CircularProgress, TextField, useTheme } from "@mui/material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import React, { useState } from "react";
import { validatePassword } from "src/auth/utils/validatePassword";
import PasswordInput from "src/theme/PasswordInput/PasswordInput";
import PasswordRequirements from "src/auth/components/PasswordRequirements/PasswordRequirements";

const uniqueId = "6cf1a0fa-8d75-4342-bf6b-1203d5b114d7";

export const DATA_TEST_ID = {
  FORM: `register-form-${uniqueId}`,
  REGISTRATION_CODE_INPUT: `register-registration-code-input-${uniqueId}`,
  NAME_INPUT: `register-name-input-${uniqueId}`,
  EMAIL_INPUT: `register-email-input-${uniqueId}`,
  PASSWORD_INPUT: `register-password-input-${uniqueId}`,
  REGISTER_BUTTON: `register-button-${uniqueId}`,
  REGISTER_BUTTON_CIRCULAR_PROGRESS: `register-button-circular-progress-${uniqueId}`,
};

export interface RegisterFormProps {
  disabled?: boolean;
  notifyOnRegister: (name: string, email: string, password: string) => void;
  isRegistering: boolean;
}

const RegisterWithEmailForm: React.FC<Readonly<RegisterFormProps>> = ({
  disabled = false,
  notifyOnRegister,
  isRegistering,
}) => {
  const theme = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordValid, setIsPasswordValid] = useState(true);
  const [validationResults, setValidationResults] = useState(validatePassword(""));

  const handleNameChange = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setName(event.target.value);
  };
  const handleEmailChange = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setEmail(event.target.value);
  };

  const handlePasswordChange = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const newPassword = event.target.value;
    setPassword(newPassword);
    const validationResult = validatePassword(newPassword);
    setValidationResults(validationResult);
    setIsPasswordValid(Object.values(validationResult).every(Boolean));
  };

  const handleRegister = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const passwordValidationResult = validatePassword(password);
    const isValid = Object.values(passwordValidationResult).every(Boolean);
    setValidationResults(passwordValidationResult);
    setIsPasswordValid(isValid);

    if (isValid) {
      notifyOnRegister(name, email, password);
    }
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      width={"100%"}
      justifyContent={"space-evenly"}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
      component="form"
      onSubmit={handleRegister}
      data-testid={DATA_TEST_ID.FORM}
    >
      <TextField
        fullWidth
        label="Name"
        variant="outlined"
        disabled={isRegistering || disabled}
        required
        onChange={(e) => handleNameChange(e)}
        inputProps={{ "data-testid": DATA_TEST_ID.NAME_INPUT }}
      />
      <TextField
        fullWidth
        label="Email"
        type="email"
        disabled={isRegistering || disabled}
        variant="outlined"
        required
        onChange={(e) => handleEmailChange(e)}
        inputProps={{ "data-testid": DATA_TEST_ID.EMAIL_INPUT }}
      />
      <PasswordInput
        fullWidth
        label="Password"
        disabled={isRegistering || disabled}
        variant="outlined"
        required
        onChange={(e) => handlePasswordChange(e)}
        inputProps={{ "data-testid": DATA_TEST_ID.PASSWORD_INPUT }}
        error={!isPasswordValid && password !== ""}
        helperText={password && !isPasswordValid && <PasswordRequirements validationResults={validationResults} />}
      />
      <PrimaryButton
        fullWidth
        variant="contained"
        color="primary"
        style={{ marginTop: 16 }}
        type="submit"
        disabled={isRegistering || disabled || !isPasswordValid}
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
