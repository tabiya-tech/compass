import React, { useCallback, useContext, useEffect, useState } from "react";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { Box, Button, Divider, Typography, useTheme } from "@mui/material";
import FirebaseSocialAuthenticationService
  from "src/auth/services/FirebaseAuthenticationService/socialAuth/FirebaseSocialAuthentication.service";
import { FirebaseError, getUserFriendlyFirebaseErrorMessage } from "src/error/FirebaseError/firebaseError";
import { GoogleIcon } from "src/theme/Icons/GoogleIcon";
import { getUserFriendlyErrorMessage, RestAPIError } from "src/error/restAPIError/RestAPIError";
import authStateService from "src/auth/services/AuthenticationState.service";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import RegistrationCodeFormModal, {
  RegistrationCodeFormModalState,
} from "src/auth/components/registrationCodeFormModal/RegistrationCodeFormModal";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { invitationsService } from "src/auth/services/invitationsService/invitations.service";
import { InvitationStatus, InvitationType } from "src/auth/services/invitationsService/invitations.types";
import { Language } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { getRegistrationDisabled } from "src/envService";

const uniqueId = "f0324e97-83fd-49e6-95c3-1043751fa1db";
export const DATA_TEST_ID = {
  FIREBASE_AUTH: `firebase-auth-${uniqueId}`,
  FIREBASE_FALLBACK_TEXT: `firebase-fallback-text-${uniqueId}`,
  FIREBASE_AUTH_CONTAINER: `firebase-auth-container-${uniqueId}`,
  CONTINUE_WITH_GOOGLE: `continue-with-google-${uniqueId}`,
  CONTINUE_WITH_GOOGLE_BUTTON: `continue-with-google-button-${uniqueId}`,
};

export interface SocialAuthProps {
  registrationCode?: string;
  disabled?: boolean;
  label?: string;
  postLoginHandler: () => void;
  isLoading: boolean;
  notifyOnLoading: (loading: boolean) => void;
}

const SocialAuth: React.FC<Readonly<SocialAuthProps>> = ({
                                                           registrationCode,
                                                           disabled = false,
                                                           label,
                                                           postLoginHandler,
                                                           isLoading,
                                                           notifyOnLoading,
                                                         }) => {
  const isOnline = useContext(IsOnlineContext);

  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const [_registrationCode, setRegistrationCode] = useState(registrationCode);

  const [showRegistrationCodeForm, setShowRegistrationCodeForm] = useState<RegistrationCodeFormModalState>(
    RegistrationCodeFormModalState.HIDE,
  );

  useEffect(() => {
    setRegistrationCode(registrationCode);
  }, [registrationCode]);

  const handleError = useCallback(
    async (error: Error) => {
      // if the registration code is not valid or something goes wrong, log the user out
      const firebaseSocialAuthServiceInstance = FirebaseSocialAuthenticationService.getInstance();
      await firebaseSocialAuthServiceInstance.logout();
      console.info("Social login failed or registration code invalid. Logging out user.");

      // clear the registration code from the state
      setRegistrationCode(registrationCode);
      let errorMessage;
      if (error instanceof RestAPIError) {
        errorMessage = getUserFriendlyErrorMessage(error);
      } else if (error instanceof FirebaseError) {
        errorMessage = getUserFriendlyFirebaseErrorMessage(error);
      } else {
        errorMessage = error.message;
      }

      console.error(error);
      enqueueSnackbar(`Failed to login: ${errorMessage}`, { variant: "error" });
    },
    [enqueueSnackbar, registrationCode],
  );

  const registerUser = useCallback(
    async (registrationCode: string) => {
      try {
        // first check if the invitation code is valid
        const _user = authStateService.getInstance().getUser();
        if (!_user) {
          throw new Error("Something went wrong: No user found");
        }
        const invitation = await invitationsService.checkInvitationCodeStatus(registrationCode);
        if (invitation.status === InvitationStatus.INVALID) {
          throw Error("The registration code is invalid");
        }
        if (invitation.invitation_type !== InvitationType.REGISTER) {
          throw Error("The invitation code is not for registration");
        }

        // create user preferences for the first time.
        // in order to do this, there needs to be a logged-in user in the persistent storage
        const prefs = await UserPreferencesService.getInstance().createUserPreferences({
          user_id: _user.id,
          invitation_code: invitation.invitation_code,
          language: Language.en,
        });
        UserPreferencesStateService.getInstance().setUserPreferences(prefs);
      } catch (error: any) {
        await handleError(error);
      }
    },
    [handleError],
  );

  const loginWithPopup = useCallback(async () => {
    try {
      notifyOnLoading(true);
      const registrationDisabled = getRegistrationDisabled().toLowerCase() === "true";
      // first login with Google
      const firebaseSocialAuthServiceInstance = FirebaseSocialAuthenticationService.getInstance();
      await firebaseSocialAuthServiceInstance.loginWithGoogle();
      console.info("User logged in via Google.");
      // check if the user is already registered
      const prefs = UserPreferencesStateService.getInstance().getUserPreferences();
      // if the user is not registered, create user preferences for the first time
      if (!prefs) {
        // if registration is disabled, show an error message
        if (registrationDisabled) {
          enqueueSnackbar("This account isn’t registered. Please contact the provider of this link.", { variant: "error" });
          return;
        }

        // if no registration code was provided, show the registration code form
        if (!_registrationCode) {
          setShowRegistrationCodeForm(RegistrationCodeFormModalState.SHOW);
          return;
        }
        await registerUser(_registrationCode);
      } else {
        UserPreferencesStateService.getInstance().setUserPreferences(prefs);
      }
      postLoginHandler();
    } catch (error: any) {
      await handleError(error);
    } finally {
      notifyOnLoading(false);
    }
  }, [notifyOnLoading, postLoginHandler, _registrationCode, registerUser, enqueueSnackbar, handleError]);

  const handleRegistrationCodeSuccess = useCallback(
    async (registrationCode: string) => {
      setShowRegistrationCodeForm(RegistrationCodeFormModalState.LOADING);
      await registerUser(registrationCode);
      setRegistrationCode(registrationCode);
      postLoginHandler();
      setShowRegistrationCodeForm(RegistrationCodeFormModalState.HIDE);
    },
    [registerUser, postLoginHandler],
  );

  const socialAuthLoading = isLoading || !isOnline || disabled;

  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      width="100%"
      data-testid={DATA_TEST_ID.FIREBASE_AUTH_CONTAINER}
    >
      <Divider
        textAlign="center"
        sx={{
          width: "100%",
          paddingY: theme.fixedSpacing(theme.tabiyaSpacing.xs),
        }}
      >
        <Typography
          variant="subtitle2"
          padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
          data-testid={DATA_TEST_ID.CONTINUE_WITH_GOOGLE}
        >
          Or continue with
        </Typography>
      </Divider>
      <Box width="100%">
        <div data-test_id={DATA_TEST_ID.FIREBASE_AUTH}>
          <Button
            variant="text"
            size={"medium"}
            disabled={socialAuthLoading}
            fullWidth
            id={"firebaseui-auth-container"}
            data-testid={DATA_TEST_ID.CONTINUE_WITH_GOOGLE_BUTTON}
            onClick={loginWithPopup}
            sx={{
              paddingX: 4,
              display: "flex",
              justifyItems: "center",
              alignContent: "center",
              gap: 2,
              color: (theme) => theme.palette.tabiyaBlue.light,
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <GoogleIcon disabled={socialAuthLoading} />
            </div>
            <Typography variant="body2">{label ?? "Login with Google"}</Typography>
          </Button>
          {!isOnline && (
            <Typography
              variant="subtitle2"
              sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}
              data-testid={DATA_TEST_ID.FIREBASE_FALLBACK_TEXT}
            >
              Google login is not available when offline.
            </Typography>
          )}
        </div>
      </Box>
      <RegistrationCodeFormModal
        modalState={showRegistrationCodeForm}
        onClose={() => setShowRegistrationCodeForm(RegistrationCodeFormModalState.HIDE)}
        onSuccess={handleRegistrationCodeSuccess}
      />
    </Box>
  );
};

export default React.memo(SocialAuth);
