import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Container, Typography } from "@mui/material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import AuthHeader from "src/auth/components/AuthHeader/AuthHeader";
import { routerPaths } from "src/app/routerPaths";
import { useNavigate } from "react-router-dom";
import BugReportButton from "src/feedback/bugReport/bugReportButton/BugReportButton";

const uniqueId = "f1228c6a-e447-4946-b810-0c7ddc8ca833";

export const DATA_TEST_ID = {
  VERIFY_EMAIL_CONTAINER: `verification-container-${uniqueId}`,
  LOGO: `verification-logo-${uniqueId}`,
  TITLE: `verification-title-${uniqueId}`,
  VERIFICATION_BODY: `verification-body-${uniqueId}`,
  LANGUAGE_SELECTOR: `verification-language-selector-${uniqueId}`,
  BACK_TO_LOGIN_BUTTON: `verification-back-to-login-button-${uniqueId}`,
};

const VerifyEmail: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  /**
   * Handle when a user clicks back to login
   */
  const handleBackToLogin = async () => {
    navigate(routerPaths.LOGIN, { replace: true });
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
          title={t("auth.pages.verifyEmail.registrationThankYou")}
          subtitle={<Typography variant="body2">{t("auth.pages.verifyEmail.verificationEmailSentMessage")}</Typography>}
        />
        <PrimaryButton
          fullWidth
          variant="contained"
          color="primary"
          style={{ marginTop: 16 }}
          data-testid={DATA_TEST_ID.BACK_TO_LOGIN_BUTTON}
          onClick={handleBackToLogin}
        >
          {t("common.buttons.backToLogin")}
        </PrimaryButton>
      </Box>
      <BugReportButton bottomAlign={true} />
    </Container>
  );
};

export default VerifyEmail;
