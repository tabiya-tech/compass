import { Box, CircularProgress, TextField, useTheme } from "@mui/material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { useTranslation } from "react-i18next";
import React, { useState } from "react";
import PasswordInput from "src/theme/PasswordInput/PasswordInput";

const uniqueId = "6cf1a0fa-8d75-4342-bf6b-1203d5b114d7";

export const DATA_TEST_ID = {
  FORM: `register-form-${uniqueId}`,
  REGISTRATION_CODE_INPUT: `register-registration-code-input-${uniqueId}`,
  USERNAME_INPUT: `register-username-input-${uniqueId}`,
  EMAIL_INPUT: `register-email-input-${uniqueId}`,
  PASSWORD_INPUT: `register-password-input-${uniqueId}`,
  REGISTER_BUTTON: `register-button-${uniqueId}`,
  REGISTER_BUTTON_CIRCULAR_PROGRESS: `register-button-circular-progress-${uniqueId}`,
};

export interface RegisterFormProps {
  disabled?: boolean;
  notifyOnRegister: (email: string, password: string) => void;
  isRegistering: boolean;
}

const RegisterWithEmailForm: React.FC<Readonly<RegisterFormProps>> = ({
  disabled = false,
  notifyOnRegister,
  isRegistering,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordValid, setIsPasswordValid] = useState(false);

  const handleEmailChange = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setEmail(event.target.value);
  };

  const handlePasswordChange = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  const handleRegister = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isPasswordValid) {
      notifyOnRegister(email, password);
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
        label={t("common.fields.email")}
        type="email"
        disabled={isRegistering || disabled}
        variant="outlined"
        required
        onChange={(e) => handleEmailChange(e)}
        inputProps={{ "data-testid": DATA_TEST_ID.EMAIL_INPUT }}
      />
      <PasswordInput
        fullWidth
        label={t("common.fields.password")}
        disabled={isRegistering || disabled}
        variant="outlined"
        required
        onChange={(e) => handlePasswordChange(e)}
        value={password}
        onValidityChange={setIsPasswordValid}
        inputProps={{ "data-testid": DATA_TEST_ID.PASSWORD_INPUT }}
      />
      <PrimaryButton
        fullWidth
        variant="contained"
        color="primary"
        style={{ marginTop: 16 }}
        type="submit"
        disabled={isRegistering || disabled || !isPasswordValid || !email}
        disableWhenOffline={true}
        data-testid={DATA_TEST_ID.REGISTER_BUTTON}
      >
        {isRegistering ? (
          <CircularProgress
            color={"secondary"}
            aria-label={t("registering_aria")}
            data-testid={DATA_TEST_ID.REGISTER_BUTTON_CIRCULAR_PROGRESS}
            size={16}
            sx={{ marginTop: theme.tabiyaSpacing.sm, marginBottom: theme.tabiyaSpacing.sm }}
          />
        ) : (
          t("common.buttons.register")
        )}
      </PrimaryButton>
    </Box>
  );
};

export default RegisterWithEmailForm;
