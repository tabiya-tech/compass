import React from "react";
import { Box, Container } from "@mui/material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import AuthHeader from "src/auth/components/AuthHeader/AuthHeader";

const uniqueId = "f1228c6a-e447-4946-b810-0c7ddc8ca833";

export const DATA_TEST_ID = {
  VERIFY_EMAIL_CONTAINER: `verification-container-${uniqueId}`,
  LOGO: `verification-logo-${uniqueId}`,
  TITLE: `verification-title-${uniqueId}`,
  VERIFICATION_BODY: `verification-body-${uniqueId}`,
  LANGUAGE_SELECTOR: `verification-language-selector-${uniqueId}`,
  BACK_TO_LOGIN_BUTTON: `verification-back-to-login-button-${uniqueId}`,
};

export interface VerifyEmailProps {
  notifyOnEmailVerified: () => void;
}

const VerifyEmail: React.FC<Readonly<VerifyEmailProps>> = ({ notifyOnEmailVerified }) => {
  /**
   * Handle when a user clicks back to login
   */
  const handleBackToLogin = async () => {
    notifyOnEmailVerified();
  };

  return (
    <Container maxWidth="xs" sx={{ height: "100%" }} data-testid={DATA_TEST_ID.VERIFY_EMAIL_CONTAINER}>
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent={"space-evenly"}
        m={4}
        height={"80%"}
      >
        <AuthHeader
          title={"Thank you for registering to Compass."}
          subtitle={
            "A verification email has been sent to your email address. To continue, please verify your email address first."
          }
        />
        <PrimaryButton
          fullWidth
          variant="contained"
          color="primary"
          style={{ marginTop: 16 }}
          data-testid={DATA_TEST_ID.BACK_TO_LOGIN_BUTTON}
          onClick={handleBackToLogin}
        >
          Back to Login
        </PrimaryButton>
      </Box>
    </Container>
  );
};

export default VerifyEmail;
