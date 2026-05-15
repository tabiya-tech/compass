import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Box, Container, Typography, useTheme } from "@mui/material";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import AuthPageShell from "src/auth/components/AuthPageShell/AuthPageShell";
import { routerPaths } from "src/app/routerPaths";
import { useNavigate } from "react-router-dom";
import MetricsService from "src/metrics/metricsService";
import { EventType } from "src/metrics/types";
import { getDarkLogoUrl } from "src/envService";

const uniqueId = "f1228c6a-e447-4946-b810-0c7ddc8ca833";

export const DATA_TEST_ID = {
  VERIFY_EMAIL_CONTAINER: `verification-container-${uniqueId}`,
  LOGO: `verification-logo-${uniqueId}`,
  TITLE: `verification-title-${uniqueId}`,
  VERIFICATION_BODY: `verification-body-${uniqueId}`,
  LANGUAGE_SELECTOR: `verification-language-selector-${uniqueId}`,
  VERIFICATION_SENT_BADGE: `verification-sent-badge-${uniqueId}`,
  BACK_TO_LOGIN_BUTTON: `verification-back-to-login-button-${uniqueId}`,
};

const VerifyEmail: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const logoSrc = getDarkLogoUrl() || `${process.env.PUBLIC_URL}/njila-logo-dark.svg`;

  useEffect(() => {
    MetricsService.getInstance().sendMetricsEvent({
      event_type: EventType.VERIFY_EMAIL_PAGE_VIEWED,
      timestamp: new Date().toISOString(),
    });
  }, []);
  /**
   * Handle when a user clicks back to login
   */
  const handleBackToLogin = async () => {
    navigate(routerPaths.LOGIN, { replace: true });
  };

  const whiteBandContent = (
    <Container
      maxWidth="sm"
      disableGutters
      sx={{ pb: theme.fixedSpacing(theme.tabiyaSpacing.xl) }}
      data-testid={DATA_TEST_ID.VERIFY_EMAIL_CONTAINER}
    >
      <Box
        component="img"
        src={`${process.env.PUBLIC_URL}/runner.svg`}
        alt=""
        sx={{
          display: "block",
          width: { xs: 180, md: 240 },
          maxWidth: "100%",
          height: "auto",
          margin: "0 auto",
          mb: theme.fixedSpacing(2),
        }}
      />
      <Box
        sx={{
          backgroundColor: "common.white",
          border: (theme) => `1px solid ${theme.palette.divider}`,
          borderRadius: 4,
          width: "100%",
          maxWidth: 560,
          mx: "auto",
          p: { xs: theme.fixedSpacing(theme.tabiyaSpacing.xl), md: theme.fixedSpacing(theme.tabiyaSpacing.xl * 1.25) },
          display: "flex",
          flexDirection: "column",
          gap: theme.fixedSpacing(theme.tabiyaSpacing.md),
        }}
      >
        <Box
          data-testid={DATA_TEST_ID.VERIFICATION_SENT_BADGE}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: theme.fixedSpacing(1),
            width: "fit-content",
            px: theme.fixedSpacing(1.2),
            py: theme.fixedSpacing(0.8),
            borderRadius: theme.fixedSpacing(theme.tabiyaSpacing.xl),
            backgroundColor: theme.palette.common.cream,
            color: theme.palette.text.primary,
            fontWeight: 600,
            fontSize: "0.85rem",
          }}
        >
          <MailOutlineRoundedIcon fontSize="small" sx={{ color: theme.palette.secondary.main }} />
          {t("auth.pages.verifyEmail.verificationEmailSentBadge")}
        </Box>
        <Box>
          <Typography variant="h1" color="primary.main" gutterBottom data-testid={DATA_TEST_ID.TITLE}>
            {t("auth.pages.verifyEmail.registrationThankYou")}
          </Typography>
          <Typography variant="body2" data-testid={DATA_TEST_ID.VERIFICATION_BODY}>
            {t("auth.pages.verifyEmail.verificationEmailSentMessage")}
          </Typography>
        </Box>
        <Box
          sx={{
            textAlign: "left",
            mt: theme.fixedSpacing(theme.tabiyaSpacing.lg),
          }}
        >
          <PrimaryButton
            variant="contained"
            color="primary"
            data-testid={DATA_TEST_ID.BACK_TO_LOGIN_BUTTON}
            onClick={handleBackToLogin}
            sx={{
              alignSelf: "flex-start",
              width: "fit-content",
            }}
          >
            {t("common.buttons.backToLogin")}
          </PrimaryButton>
        </Box>
      </Box>
    </Container>
  );

  return (
    <AuthPageShell
      logoUrl={logoSrc}
      whiteBandContent={whiteBandContent}
      whiteBandBackgroundColor={theme.palette.containerBackground.main}
    />
  );
};

export default VerifyEmail;
