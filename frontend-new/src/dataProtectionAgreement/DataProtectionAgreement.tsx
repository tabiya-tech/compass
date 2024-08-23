import React, { useCallback, useContext, useState } from "react";
import { Box, Container, styled, Typography } from "@mui/material";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { Language, UpdateUserPreferencesSpec } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { ServiceError, ServiceErrorObject, USER_FRIENDLY_ERROR_MESSAGES } from "src/error/ServiceError/ServiceError";
import ErrorConstants from "src/error/ServiceError/ServiceError.constants";
import { StatusCodes } from "http-status-codes";
import LanguageContextMenu from "src/i18n/languageContextMenu/LanguageContextMenu";
import { UserPreferencesContext } from "src/userPreferences/UserPreferencesProvider/UserPreferencesProvider";
import { writeServiceErrorToLog } from "src/error/ServiceError/logger";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import { AuthContext } from "src/auth/AuthProvider";
import { userPreferencesService } from "../userPreferences/UserPreferencesService/userPreferences.service";

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

export interface DataProtectionAgreementProps {
  notifyOnAcceptDPA: () => void;
  isLoading: boolean;
}

const DataProtectionAgreement: React.FC<Readonly<DataProtectionAgreementProps>> = ({
  notifyOnAcceptDPA,
  isLoading,
}) => {
  const navigate = useNavigate();
  const [isAcceptingDPA, setIsAcceptingDPA] = useState(false);
  const { updateUserPreferences } = useContext(UserPreferencesContext);
  const { user } = useContext(AuthContext);
  const { enqueueSnackbar } = useSnackbar();
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
      const newUserPreferenceSpecs: UpdateUserPreferencesSpec = {
        user_id: user.id,
        language: Language.en,
        accepted_tc: new Date(),
      };
      setIsAcceptingDPA(true);
      userPreferencesService.updateUserPreferences(
        newUserPreferenceSpecs,
        (_prefs) => {
          updateUserPreferences(_prefs);
          notifyOnAcceptDPA();
          enqueueSnackbar("Data Protection Agreement Accepted", { variant: "success" });
        },
        (error) => {
          writeServiceErrorToLog(error, console.error);

          // if the invitation code is invalid, show a user-friendly message
          // otherwise, navigate to the login page and show a generic error message
          if (
            (error?.details as ServiceErrorObject)?.details === USER_FRIENDLY_ERROR_MESSAGES.INVALID_INVITATION_CODE
          ) {
            enqueueSnackbar(USER_FRIENDLY_ERROR_MESSAGES.INVALID_INVITATION_CODE, { variant: "error" });
          } else {
            navigate(routerPaths.LOGIN, { replace: true });
            enqueueSnackbar("Failed to update user preferences", { variant: "error" });
          }
        }
      );
    } catch (e) {
      console.error(e);
      enqueueSnackbar("Failed to update user preferences", { variant: "error" });
      console.error("Failed to update user preferences", e);
    } finally {
      setIsAcceptingDPA(false);
    }
  }, [user, enqueueSnackbar, updateUserPreferences, notifyOnAcceptDPA, navigate]);

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
          <LanguageContextMenu />
        </Box>
        <Typography variant="h4" gutterBottom data-testid={DATA_TEST_ID.TITLE}>
          Thank you for using Compass.
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

        <PrimaryButton
          fullWidth
          variant="contained"
          color="primary"
          style={{ marginTop: 16 }}
          disabled={isAcceptingDPA || isLoading}
          disableWhenOffline={true}
          data-testid={DATA_TEST_ID.ACCEPT_DPA_BUTTON}
          onClick={handleAcceptedDPA}
        >
          Sure, I am ready.
        </PrimaryButton>
      </Box>
    </Container>
  );
};

export default DataProtectionAgreement;
