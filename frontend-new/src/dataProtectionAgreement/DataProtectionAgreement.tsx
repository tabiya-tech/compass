import React, { useCallback, useState } from "react";
import { Box, Checkbox, Container, styled, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { Language, UpdateUserPreferencesSpec } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { getUserFriendlyErrorMessage, ServiceError } from "src/error/ServiceError/ServiceError";
import LanguageContextMenu from "src/i18n/languageContextMenu/LanguageContextMenu";
import { writeServiceErrorToLog } from "src/error/ServiceError/logger";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { useNavigate } from "react-router-dom";
import { userPreferencesService } from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { routerPaths } from "src/app/routerPaths";
import { userPreferencesStateService } from "src/userPreferences/UserPreferencesStateService";
import authStateService from "src/auth/services/AuthenticationState.service";
import { Theme } from "@mui/material/styles";
import AuthenticationServiceFactory from "src/auth/services/Authentication.service.factory";
import { AuthenticationError } from "src/error/commonErrors";

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
  REJECT_DPA_BUTTON: `dpa-reject-button-${uniqueId}`,
  CIRCULAR_PROGRESS: `dpa-circular-progress-${uniqueId}`,
  ACCEPT_DPA_CHECKBOX: `dpa-accept-checkbox-${uniqueId}`,
  TERMS_AND_CONDITIONS: `dpa-terms-and-conditions-${uniqueId}`,
};

const StyledAnchor = styled("a")(({ theme }) => ({
  color: theme.palette.tabiyaBlue.main,
  textDecoration: "underline",
  cursor: "pointer",
  fontWeight: "bold",
  whiteSpace: "nowrap",
  "&:hover": {
    color: theme.palette.tabiyaBlue.light,
  },
}));

const DataProtectionAgreement: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [isAcceptingDPA, setIsAcceptingDPA] = useState(false);
  const [isRejectingDPA, setIsRejectingDPA] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));

  /**
   * Persist the user's chosen preferences to the backend
   */
  const persistUserPreferences = useCallback(async () => {
    try {
      const user = authStateService.getInstance().getUser();
      if (!user) {
        enqueueSnackbar("User not found", { variant: "error" });
        navigate(routerPaths.LOGIN);
        return;
      }

      const newUserPreferenceSpecs: UpdateUserPreferencesSpec = {
        user_id: user.id,
        language: Language.en,
        accepted_tc: new Date(),
      };
      setIsAcceptingDPA(true);
      const prefs = await userPreferencesService.updateUserPreferences(newUserPreferenceSpecs);
      userPreferencesStateService.setUserPreferences(prefs);
      navigate(routerPaths.ROOT, { replace: true });
      enqueueSnackbar("Data Protection Agreement Accepted", { variant: "success" });
    } catch (e) {
      if (e instanceof ServiceError) {
        writeServiceErrorToLog(e, console.error);
        enqueueSnackbar(getUserFriendlyErrorMessage(e), { variant: "error" });
      } else {
        enqueueSnackbar(`Failed to update user preferences: ${(e as Error).message}`, { variant: "error" });
        console.error(new AuthenticationError("Failed to update user preferences", e as Error));
      }
    } finally {
      setIsAcceptingDPA(false);
    }
  }, [enqueueSnackbar, navigate]);

  /**
   * Handle when a user accepts the data protection agreement
   */
  const handleAcceptedDPA = async () => {
    await persistUserPreferences();
  };

  /**
   * Handle when a user rejects the data protection agreement
   */
  const handleRejectedDPA = useCallback(
    async (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();

      setIsRejectingDPA(true);

      try {
        const authenticationService = AuthenticationServiceFactory.getCurrentAuthenticationService();
        await authenticationService!.logout();
        navigate(routerPaths.LOGIN, { replace: true });
        enqueueSnackbar("Successfully logged out.", { variant: "success" });
      } catch (e) {
        console.error(new AuthenticationError("Failed to log out", e as Error));
        enqueueSnackbar("Failed to log out.", { variant: "error" });
      } finally {
        setIsRejectingDPA(false);
      }
    },
    [enqueueSnackbar, navigate]
  );

  /**
   * Handle when a user checks the checkbox
   */
  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsChecked(event.target.checked);
  };

  const label = "I have read and agree to the ";

  return (
    <Container maxWidth="xs" sx={{ height: "100%" }} data-testid={DATA_TEST_ID.DPA_CONTAINER}>
      <Box
        display="flex"
        flexDirection="column"
        alignItems="start"
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
          Before we begin...
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
          Always double-check important details and avoid sharing personal information about yourself and others with
          the AI during the conversation.
          <br />
          <br />
          Help us keep all AI interactions safe and positive! 😊
          <br />
          <br />
        </Typography>
        <Box display="flex" alignItems="start" paddingBottom={3} gap={isSmallMobile ? 3 : 1.5}>
          <Checkbox
            checked={isChecked}
            onChange={handleCheckboxChange}
            sx={{ padding: 0, marginTop: 0.5, transform: "scale(1.3)" }}
            inputProps={{ "aria-label": label }}
            data-testid={DATA_TEST_ID.ACCEPT_DPA_CHECKBOX}
          />
          <Typography variant="body2" data-testid={DATA_TEST_ID.TERMS_AND_CONDITIONS}>
            {label}
            <StyledAnchor href="https://compass.tabiya.org/dpa.html" target="_blank" rel="noreferrer">
              Terms and Conditions
            </StyledAnchor>{" "}
            of Compass.
          </Typography>
        </Box>
        <Typography>
          Are you ready to start?
          <br />
        </Typography>
        <Box
          sx={{
            width: "100%",
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: theme.spacing(2),
            gap: theme.tabiyaSpacing.xl,
          }}
        >
          <StyledAnchor data-testid={DATA_TEST_ID.REJECT_DPA_BUTTON} onClick={handleRejectedDPA}>
            No, thank you
          </StyledAnchor>
          <PrimaryButton
            fullWidth
            variant="contained"
            color="primary"
            disabled={isAcceptingDPA || !isChecked || isRejectingDPA}
            disableWhenOffline={true}
            data-testid={DATA_TEST_ID.ACCEPT_DPA_BUTTON}
            onClick={handleAcceptedDPA}
          >
            Sure, I am ready
          </PrimaryButton>
        </Box>
      </Box>
    </Container>
  );
};

export default DataProtectionAgreement;
