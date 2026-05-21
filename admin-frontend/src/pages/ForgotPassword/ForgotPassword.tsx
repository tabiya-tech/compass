import React, { useState } from "react";
import { Alert, Box, Button, CircularProgress, Container, Link, TextField, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import { getDarkLogoUrl } from "src/envService";
import FirebaseEmailAuthenticationService from "src/auth/services/FirebaseAuthenticationService/FirebaseEmailAuthenticationService";

const uniqueId = "forgot-password-page-2e4f6a8b-0c1d-4e3f-5a6b-7c8d9e0f1a2b";

export const DATA_TEST_ID = {
  FORGOT_PAGE_CONTAINER: `${uniqueId}-container`,
  FORGOT_PAGE_LOGO: `${uniqueId}-logo`,
  FORGOT_PAGE_EMAIL: `${uniqueId}-email`,
  FORGOT_PAGE_SUBMIT: `${uniqueId}-submit`,
  FORGOT_PAGE_SUCCESS: `${uniqueId}-success`,
};

const ForgotPassword: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const preferredSrc = getDarkLogoUrl() || `${process.env.PUBLIC_URL}/njila-logo-dark.svg`;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await FirebaseEmailAuthenticationService.getInstance().resetPassword(email.trim());
    } catch {
      // Anti-enumeration: show the same neutral success regardless of whether
      // Firebase recognised the email (auth/user-not-found) or any other
      // failure. The user is told to check inbox; nothing is leaked.
    } finally {
      setSubmitting(false);
      setSubmitted(true);
    }
  };

  return (
    <Container maxWidth="sm" data-testid={DATA_TEST_ID.FORGOT_PAGE_CONTAINER}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <Box
          sx={{
            padding: theme.spacing(4),
            width: "100%",
            borderRadius: theme.tabiyaRounding.sm,
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "center", marginBottom: theme.tabiyaSpacing.lg }}>
            <Box
              component="img"
              src={preferredSrc}
              alt={t("forgotPassword.logoAlt")}
              data-testid={DATA_TEST_ID.FORGOT_PAGE_LOGO}
              sx={{ height: 64, width: "auto", maxWidth: "100%" }}
            />
          </Box>

          <Typography variant="h4" component="h1" gutterBottom textAlign="center">
            {t("forgotPassword.title")}
          </Typography>

          {submitted ? (
            <Alert severity="success" sx={{ mt: 2 }} data-testid={DATA_TEST_ID.FORGOT_PAGE_SUCCESS}>
              {t("forgotPassword.success")}
            </Alert>
          ) : (
            <>
              <Typography
                variant="body2"
                color="text.secondary"
                textAlign="center"
                sx={{ marginBottom: theme.tabiyaSpacing.lg }}
              >
                {t("forgotPassword.subtitle")}
              </Typography>

              <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
                <TextField
                  fullWidth
                  label={t("forgotPassword.email")}
                  type="email"
                  margin="normal"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  autoComplete="email"
                  data-testid={DATA_TEST_ID.FORGOT_PAGE_EMAIL}
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={submitting || email.trim() === ""}
                  sx={{ mt: 3, mb: 2, height: 48 }}
                  data-testid={DATA_TEST_ID.FORGOT_PAGE_SUBMIT}
                >
                  {submitting ? <CircularProgress size={24} color="inherit" /> : t("forgotPassword.submit")}
                </Button>
              </Box>
            </>
          )}

          <Typography variant="body2" textAlign="center" sx={{ mt: 2 }}>
            <Link component="button" type="button" onClick={() => navigate(routerPaths.LOGIN)}>
              {t("forgotPassword.backToLogin")}
            </Link>
          </Typography>
        </Box>
      </Box>
    </Container>
  );
};

export default ForgotPassword;
