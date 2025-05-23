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
import { Theme } from "@mui/material/styles";

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
            style: {
              backgroundColor: TabiyaBasicColors.LightGreen,
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
      >
        <DialogContent
          sx={{
            height: "100%",
            padding: 0,
            paddingX: isSmallMobile
              ? theme.fixedSpacing(theme.tabiyaSpacing.md)
              : theme.fixedSpacing(theme.tabiyaSpacing.lg),
          }}
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
                    Discover your Full Potential with Compass!
                  </Typography>
                  <Typography variant="body2" textAlign="center">
                    Uncover and articulate your skills through natural AI-guided conversations. Create a free account to
                    build your comprehensive skill profile and connect with better job opportunities.
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
                <PrimaryButton fullWidth onClick={() => navigate(routerPaths.LOGIN)}>
                  Login
                </PrimaryButton>
                <SecondaryButton
                  fullWidth
                  style={{ border: `1px solid ${theme.palette.text.secondary}` }}
                  onClick={() => navigate(routerPaths.REGISTER)}
                >
                  Sign up for free
                </SecondaryButton>
              </Box>
              <Divider textAlign="center" style={{ width: "100%" }}>
                <Typography variant="subtitle2" padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
                  or
                </Typography>
              </Divider>
              <CustomLink onClick={handleContinueAsGuest} disableWhenOffline={true}>
                Continue as Guest
              </CustomLink>
            </Box>
          </Box>
          <BugReportButton bottomAlign={true} />
        </DialogContent>
      </Dialog>
      <Backdrop isShown={isLoading} message={"Logging you in..."} />
    </>
  );
};

export default Landing;
