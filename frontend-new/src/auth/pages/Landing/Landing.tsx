import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import { Box, Typography, useTheme, Dialog, Divider, DialogContent, useMediaQuery } from "@mui/material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import SecondaryButton from "src/theme/SecondaryButton/SecondaryButton";
import CustomLink from "src/theme/CustomLink/CustomLink";
import AuthHeader from "src/auth/components/AuthHeader/AuthHeader";
import BugReportButton from "src/feedback/bugReport/bugReportButton/BugReportButton";
import { getApplicationLoginCode } from "src/envService";
import FirebaseInvitationCodeAuthenticationService from "src/auth/services/FirebaseAuthenticationService/invitationCodeAuth/FirebaseInvitationCodeAuthenticationService";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { AuthenticationError } from "src/error/commonErrors";
import { RestAPIError, getUserFriendlyErrorMessage } from "src/error/restAPIError/RestAPIError";
import { FirebaseError, getUserFriendlyFirebaseErrorMessage } from "src/error/FirebaseError/firebaseError";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import { TabiyaBasicColors } from "src/theme/applicationTheme/applicationTheme";
import { Theme, alpha } from "@mui/material/styles";

const uniqueId = "e9c346bb-bcc6-4aaa-aaa9-d24d09274925";

export const DATA_TEST_ID = {
  LANDING_DIALOG: `landing-dialog-${uniqueId}`,
  LANDING_DIALOG_CONTENT: `landing-dialog-content-${uniqueId}`,
  LANDING_LOGIN_BUTTON: `landing-login-button-${uniqueId}`,
  LANDING_SIGNUP_BUTTON: `landing-signup-button-${uniqueId}`,
  LANDING_GUEST_BUTTON: `landing-continue-as-guest-button-${uniqueId}`,
  LANDING_DIVIDER: `landing-divider-${uniqueId}`,
};

const Landing: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));
  const [isLoading, setIsLoading] = useState(false);

  const applicationLoginCode = useMemo(() => {
    return getApplicationLoginCode();
  }, []);

  const handleError = useCallback(
    async (error: Error) => {
      let errorMessage;
      if (error instanceof RestAPIError) {
        errorMessage = getUserFriendlyErrorMessage(error);
        console.error(error);
      } else if (error instanceof FirebaseError) {
        errorMessage = getUserFriendlyFirebaseErrorMessage(error);
        console.warn(error);
      } else {
        errorMessage = error.message;
        console.error(error);
      }
      enqueueSnackbar(`Failed to login: ${errorMessage}`, { variant: "error" });
    },
    [enqueueSnackbar]
  );

  const handlePostLogin = useCallback(async () => {
    try {
      const prefs = UserPreferencesStateService.getInstance().getUserPreferences();
      if (!prefs?.accepted_tc || isNaN(prefs?.accepted_tc.getTime())) {
        navigate(routerPaths.CONSENT, { replace: true });
      } else {
        navigate(routerPaths.ROOT, { replace: true });
        enqueueSnackbar("Welcome!", { variant: "success" });
      }
    } catch (error: unknown) {
      console.error(new AuthenticationError("An error occurred while trying to get your preferences", error));
      let errorMessage;
      if (error instanceof RestAPIError) {
        errorMessage = getUserFriendlyErrorMessage(error);
      } else {
        errorMessage = (error as Error).message;
      }
      enqueueSnackbar(`An error occurred while trying to get your preferences: ${errorMessage}`, {
        variant: "error",
      });
    }
  }, [navigate, enqueueSnackbar]);

  const handleContinueAsGuest = useCallback(async () => {
    try {
      setIsLoading(true);
      const firebaseInvitationAuthServiceInstance = FirebaseInvitationCodeAuthenticationService.getInstance();
      await firebaseInvitationAuthServiceInstance.login(applicationLoginCode);
      enqueueSnackbar("Invitation code is valid", { variant: "success" });
      await handlePostLogin();
    } catch (error) {
      await handleError(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [applicationLoginCode, handleError, handlePostLogin, enqueueSnackbar]);

  return (
    <>
      <Dialog
        open={true}
        maxWidth="xs"
        fullWidth
        disableEscapeKeyDown
        onClose={() => {}}
        hideBackdrop={false}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: TabiyaBasicColors.LightGreen,
              "&::before": {
                content: '""',
                position: "absolute",
                inset: 0,
                backgroundColor: isLoading ? "transparent" : alpha(theme.palette.common.black, 0.5),
                // Use transition to prevent flashing
                transition: "background-color 0.2s ease-in-out",
              },
            },
          },
        }}
        PaperProps={{
          sx: {
            height: "fit-content",
            borderRadius: 2,
            width: "calc(100% - 16px)",
            position: "absolute",
            top: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            margin: "0",
          },
        }}
        data-testid={DATA_TEST_ID.LANDING_DIALOG}
      >
        <DialogContent
          sx={{
            height: "100%",
            padding: 0,
            paddingX: isSmallMobile
              ? theme.fixedSpacing(theme.tabiyaSpacing.md)
              : theme.fixedSpacing(theme.tabiyaSpacing.lg),
          }}
          data-testid={DATA_TEST_ID.LANDING_DIALOG_CONTENT}
        >
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
            width="100%"
            sx={{
              height: "100%",
              paddingBottom: theme.fixedSpacing(theme.tabiyaSpacing.xl),
            }}
          >
            <AuthHeader
              title="Welcome to Compass!"
              subtitle={
                <>
                  <Typography
                    variant="body1"
                    fontWeight="bold"
                    textAlign="center"
                    paddingBottom={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
                  >
                    Discover your Full Potential
                  </Typography>
                  <Typography variant="body2" textAlign="center">
                    Uncover and articulate your skills through natural AI-guided conversations. Build your skill profile
                    and download a CV to kickstart your job search. Create a free account to save your progress and
                    revisit your conversation history.
                  </Typography>
                </>
              }
            />
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
              width="100%"
            >
              <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.md)} width="100%">
                <PrimaryButton
                  fullWidth
                  disabled={isLoading}
                  onClick={() => navigate(routerPaths.LOGIN)}
                  data-testid={DATA_TEST_ID.LANDING_LOGIN_BUTTON}
                >
                  Login
                </PrimaryButton>
                <SecondaryButton
                  fullWidth
                  disabled={isLoading}
                  style={{ border: `1px solid ${theme.palette.text.secondary}` }}
                  onClick={() => navigate(routerPaths.REGISTER)}
                  data-testid={DATA_TEST_ID.LANDING_SIGNUP_BUTTON}
                >
                  Register
                </SecondaryButton>
              </Box>
              {applicationLoginCode && (
                <>
                  <Divider textAlign="center" style={{ width: "100%" }} data-testid={DATA_TEST_ID.LANDING_DIVIDER}>
                    <Typography variant="subtitle2" padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
                      or
                    </Typography>
                  </Divider>
                  <CustomLink
                    onClick={handleContinueAsGuest}
                    disabled={isLoading}
                    disableWhenOffline={true}
                    data-testid={DATA_TEST_ID.LANDING_GUEST_BUTTON}
                  >
                    Continue as Guest
                  </CustomLink>
                </>
              )}
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
      <BugReportButton bottomAlign={true} />
      <Backdrop isShown={isLoading} message="Logging you in..." />
    </>
  );
};

export default Landing;
