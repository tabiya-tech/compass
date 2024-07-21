import React, { useCallback, useContext, useEffect, useState } from "react";
import { Box, Button, Container, styled, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { AuthContext } from "src/auth/Providers/AuthProvider/AuthProvider";
import { Language, UserPreference } from "src/auth/services/UserPreferences/userPreferences.types";
import { ServiceError } from "src/error/error";
import ErrorConstants from "src/error/error.constants";
import { StatusCodes } from "http-status-codes";
import AuthContextMenu from "src/auth/components/AuthContextMenu/AuthContextMenu";
import { UserPreferencesContext } from "src/auth/Providers/UserPreferencesProvider/UserPreferencesProvider";
import { writeServiceErrorToLog } from "src/error/logger";

const uniqueId = "1dee3ba4-1853-40c6-aaad-eeeb0e94788d";

const HighlightedSpan = styled("span")(({ theme }) => ({
  backgroundColor: theme.palette.tabiyaYellow.light,
}));

export const DATA_TEST_ID = {
  DPA_CONTAINER: `dpa-container-${uniqueId}`,
  LOGO: `dpa-logo-${uniqueId}`,
  TITLE: `dpa-title-${uniqueId}`,
  AGREEMENT_BODY: `dpa-agreement-body-${uniqueId}`,
  DPA: `dpa-form-${uniqueId}`,
  LANGUAGE_SELECTOR: `dpa-language-selector-${uniqueId}`,
  ACCEPT_DPA_BUTTON: `dpa-accept-button-${uniqueId}`,
  CIRCULAR_PROGRESS: `dpa-circular-progress-${uniqueId}`,
};

const DataProtectionAgreement = () => {
  const { createUserPreferences, userPreferences } = useContext(UserPreferencesContext);
  const [isAcceptingDPA, setIsAcceptingDPA] = useState(false);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  /**
   * Redirect the user to the login page
   * if they are already logged in
   */
  useEffect(() => {
    // If the user is already logged in, redirect to the home page
    if (user && userPreferences?.accepted_tc) {
      navigate(routerPaths.ROOT, { replace: true });
    } else if (!user) {
      navigate(routerPaths.LOGIN, { replace: true });
    }
  }, [navigate, user, userPreferences]);

  /**
   * Persist the user's chosen preferences to the backend
   */
  const persistUserPreferences = useCallback(async () => {
    try {
      if (!user) {
        throw new ServiceError(
          "UserPreferenceService",
          "createUserPreferences",
          "POST",
          "users/preferences",
          StatusCodes.NOT_FOUND,
          ErrorConstants.ErrorCodes.NOT_FOUND,
          "User not found",
          ""
        );
      }
      const newUserPreferenceSpecs: UserPreference = {
        user_id: user.id,
        language: Language.en,
        accepted_tc: new Date(),
        sessions: [],
      };
      setIsAcceptingDPA(true);

      createUserPreferences(
        newUserPreferenceSpecs,
        (_prefs) => {
          enqueueSnackbar("Data Protection Agreement Accepted", { variant: "success" });
          navigate(routerPaths.ROOT, { replace: true });
        },
        (error) => {
          writeServiceErrorToLog(error, console.error);
          enqueueSnackbar("Failed to create user preferences", { variant: "error" });
        }
      );
    } catch (e) {
      console.error(e);
      enqueueSnackbar("Failed to create user preferences", { variant: "error" });
      console.error("Failed to create user preferences", e);
    } finally {
      setIsAcceptingDPA(false);
    }
  }, [user, enqueueSnackbar, navigate, createUserPreferences]);

  /**
   * Handle when a user accepts the data protection agreement
   */
  const handleAcceptedDPA = async () => {
    await persistUserPreferences();
  };

  return (
    <Container maxWidth="xs" sx={{ height: "100%" }} data-testid={DATA_TEST_ID.DPA_CONTAINER}>
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent={"space-evenly"}
        m={4}
        height={"80%"}
      >
        <Box display="flex" flexDirection="row" justifyContent="center" alignItems="center">
          <img
            src={`${process.env.PUBLIC_URL}/logo.svg`}
            alt="Logo"
            style={{ maxWidth: "60%", margin: "10%" }}
            data-testid={DATA_TEST_ID.LOGO}
          />
          <AuthContextMenu />
        </Box>
        <Typography variant="h4" gutterBottom data-testid={DATA_TEST_ID.TITLE}>
          Thank you for using Tabiya Compass.
        </Typography>
        <Typography variant="body2" gutterBottom data-testid={DATA_TEST_ID.AGREEMENT_BODY}>
          We created this AI tool for you with care to help you and other young people like you explore their skills and
          discover new opportunities.
          <br />
          <br />
          <HighlightedSpan>Please use AI responsibly!</HighlightedSpan>
          <br />
          <br />
          AI technology is new and far from perfect. It doesn't understand context like humans do.
          <br />
          <br />
          Always double-check any important information and avoid sharing personal data.
          <br />
          <br />
          Help us keep all AI interactions safe and positive! 😊
          <br />
          <br />
          Are you ready to start?
        </Typography>

        <Button
          fullWidth
          variant="contained"
          color="primary"
          style={{ marginTop: 16 }}
          disabled={isAcceptingDPA}
          data-testid={DATA_TEST_ID.ACCEPT_DPA_BUTTON}
          onClick={handleAcceptedDPA}
        >
          Sure, I am ready.
        </Button>
      </Box>
    </Container>
  );
};

export default DataProtectionAgreement;