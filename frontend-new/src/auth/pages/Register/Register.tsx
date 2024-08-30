import React, { useCallback, useState } from "react";
import { Box, Container, Divider, styled, TextField, Typography, useTheme } from "@mui/material";
import { NavLink as RouterNavLink, useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import SocialAuth from "src/auth/components/SocialAuth/SocialAuth";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import RegisterWithEmailForm from "src/auth/pages/Register/components/RegisterWithEmailForm/RegisterWithEmailForm";
import AuthHeader from "src/auth/components/AuthHeader/AuthHeader";
import { FirebaseError, getUserFriendlyFirebaseErrorMessage } from "src/error/FirebaseError/firebaseError";
import { writeFirebaseErrorToLog } from "src/error/FirebaseError/logger";
import { emailAuthService } from "src/auth/services/emailAuth/EmailAuth.service";
import { invitationsService } from "src/invitations/InvitationsService/invitations.service";
import { InvitationStatus, InvitationType } from "src/invitations/InvitationsService/invitations.types";
import { userPreferencesService } from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { Language } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { getUserFriendlyErrorMessage, ServiceError } from "src/error/ServiceError/ServiceError";
import { writeServiceErrorToLog } from "src/error/ServiceError/logger";
import { logoutService } from "src/auth/services/logout/logout.service";
import {
  userPreferencesStateService,
} from "src/userPreferences/UserPreferencesProvider/UserPreferencesStateService";
import { StatusCodes } from "http-status-codes";
import authStateService from "src/auth/AuthStateService";
import { TabiyaUser } from "src/auth/auth.types";

const uniqueId = "ab02918f-d559-47ba-9662-ea6b3a3606d0";

const StyledNavLink = styled(RouterNavLink)(({ theme }) => ({
  color: theme.palette.text.textAccent,
  fontStyle: "italic",
  textDecoration: "none",
  "&:hover": {
    textDecoration: "underline",
  },
}));

export const DATA_TEST_ID = {
  REGISTRATION_CODE_INPUT: `register-registration-code-input-${uniqueId}`,
  REGISTER_CONTAINER: `register-container-${uniqueId}`,
  LOGO: `register-logo-${uniqueId}`,
  TITLE: `register-title-${uniqueId}`,
  SUBTITLE: `register-subtitle-${uniqueId}`,
  FORM: `register-form-${uniqueId}`,
  NAME_INPUT: `register-name-input-${uniqueId}`,
  EMAIL_INPUT: `register-email-input-${uniqueId}`,
  PASSWORD_INPUT: `register-password-input-${uniqueId}`,
  REGISTER_BUTTON: `register-button-${uniqueId}`,
  REGISTER_BUTTON_CIRCULAR_PROGRESS: `register-button-circular-progress-${uniqueId}`,
  FORGOT_PASSWORD_LINK: `register-forgot-password-link-${uniqueId}`,
  REGISTER_USING: `register-using-${uniqueId}`,
  FIREBASE_AUTH_CONTAINER: `firebase-auth-container-${uniqueId}`,
  LOGIN_LINK: `register-login-link-${uniqueId}`,
  LANGUAGE_SELECTOR: `register-language-selector-${uniqueId}`,
};

const Register: React.FC = () => {
  const [registrationCode, setRegistrationCode] = useState<string>("");

  const theme = useTheme();

  // a state to determine if the user is currently registering with email
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  /* -----------
  * callbacks to pass to the child components
  */
  const handleRegistrationCodeChanged = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setRegistrationCode(event.target.value);
  };

  /**
   * Check if the invitation code is valid
   * @returns {Promise<boolean>} - true if the invitation code is valid, false otherwise
   */
  const isInvitationCodeValid = useCallback(async (): Promise<boolean> => {
    try {
        // Call the service method and use callbacks to determine the result
        const invitation = await invitationsService.checkInvitationCodeStatus(
          registrationCode,
        );
        if (
          invitation.status === InvitationStatus.INVALID ||
          invitation.invitation_type !== InvitationType.REGISTER
        ) {
          console.error("Invalid registration code")
          enqueueSnackbar("Invalid registration code", { variant: "error" });
          return false;
        }
        return true;
    } catch (e) {
      let errorMessage;
      if (e instanceof ServiceError) {
        writeServiceErrorToLog(e, console.error);
        errorMessage = getUserFriendlyErrorMessage(e as Error);
      } else {
        console.error(e);
        errorMessage = (e as Error).message
      }
      enqueueSnackbar(errorMessage, { variant: "error" });
      return false;
    }
  }, [enqueueSnackbar, registrationCode]);

  /**
   * Handles what happens after social registration (same process as login)
   * @param user
   */
  const handlePostLogin = useCallback(
    async (user: TabiyaUser) => {
      try {
        setIsLoading(true);
        const prefs = await userPreferencesService.getUserPreferences(
          user.id
        );
        if(prefs === null){
          throw new Error("User preferences not found");
        }
        userPreferencesStateService.setUserPreferences(prefs);
        if (!prefs?.accepted_tc || isNaN(prefs?.accepted_tc.getTime())) {
          navigate(routerPaths.DPA, { replace: true });
        } else {
          navigate(routerPaths.ROOT, { replace: true });
          enqueueSnackbar("Welcome back!", { variant: "success" });
        }
      } catch (error) {
        let errorMessage;
        if(error instanceof ServiceError) {
          writeServiceErrorToLog(error, console.error);
          errorMessage = getUserFriendlyErrorMessage(error);
        } else {
          errorMessage = (error as Error).message;
          console.error("An error occurred while trying to get your preferences", error)
        }
        enqueueSnackbar(`An error occurred while trying to get your preferences: ${errorMessage}`, { variant: "error" });
      } finally {
        setIsLoading(false);
      }
    },
    [navigate, enqueueSnackbar]
  );

  /* ------------
  * Actual registration handlers
  */
  /**
   * Handle the register form submission
   * @param name
   * @param email
   * @param password
   */
  const handleRegister = useCallback(
    async (name: string, email: string, password: string) => {
      setIsLoading(true);
      try {
        // check if the invitation code is valid before proceeding with the registration
        const pass = await isInvitationCodeValid();

        if (!pass) {
          setIsLoading(false);
          return;
        }
        const token = await emailAuthService.handleRegisterWithEmail(
          email,
          password,
          name
        );
        const _user = authStateService.updateUserByToken(token);
        if (_user) {
            // create user preferences for the first time.
            // in order to do this, there needs to be a logged in user in the persistent storage
            const prefs = await userPreferencesService.createUserPreferences(
              {
                user_id: _user.id,
                invitation_code: registrationCode,
                language: Language.en,
              }
            );
            userPreferencesStateService.setUserPreferences(prefs);
            enqueueSnackbar("Verification Email Sent!", { variant: "success" });
            // IMPORTANT NOTE: after the preferences are added, or fail to be added, we should log the user out immediately,
            // since if we don't do that, the user may be able to access the application without verifying their email
            // or accepting the dpa.
            await logoutService.handleLogout();
            userPreferencesStateService.clearUserPreferences();
            await authStateService.clearUser();

            // navigate to the verify email page
            navigate(routerPaths.VERIFY_EMAIL, { replace: true });
          } else {
           // if a user cannot be gotten from the token, we should throw an error
           throw new Error("Something went wrong while registering. Please try again.");
        }
      } catch (e: any) {
        let errorMessage;
        if (e instanceof ServiceError) {
          writeServiceErrorToLog(e, console.error);
          errorMessage = getUserFriendlyErrorMessage(e as Error);
        } else if (e instanceof FirebaseError) {
          writeFirebaseErrorToLog(e, console.error)
          errorMessage = getUserFriendlyFirebaseErrorMessage(e);
        } else {
          console.error(e);
          errorMessage = (e as Error).message
        }
        enqueueSnackbar(`Registration Failed: ${errorMessage}`, { variant: "error" });
      } finally {
        setIsLoading(false);
      }
    },
    [
      navigate,
      enqueueSnackbar,
      setIsLoading,
      isInvitationCodeValid,
      registrationCode,
    ]
  );

  /**
   * A callback to handle what to do after a social registration
   * we pass this to the SocialAuth component which will call it after a successful social registration
   * */
  const successfulSocialRegistrationCallback = async (user: TabiyaUser) => {
    setIsLoading(true)
    try {
      // create user preferences for the first time.
      const prefs = await userPreferencesService.createUserPreferences(
        {
          user_id: user.id,
          invitation_code: registrationCode,
          language: Language.en,
        }
      );
      userPreferencesStateService.setUserPreferences(prefs);
      // We use postLoginHandler because a social registration is parallel to a login
      // and the postLoginHandler is used to handle the post login actions
      await handlePostLogin(user);
    } catch (e: unknown) {
      let errorMessage;
      if (e instanceof ServiceError) {
        // if the user preferences already exist, we should just log the user in
        if((e).statusCode === StatusCodes.CONFLICT) {
          await handlePostLogin(user);
          return;
        }
        errorMessage = getUserFriendlyErrorMessage(e as Error);
        writeServiceErrorToLog(e, console.error);
      } else {
        console.error(e);
        errorMessage = (e as Error).message
      }
      enqueueSnackbar(`Failed to create preferences: ${errorMessage}`, { variant: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  /* ------------------
  * aggregated states for loading and disabling ui
  */
  // register form is in the loading state if the auth context is loading, or if the user is registering with either of the methods
  const isRegisterLoading = isLoading;

  return (
    <Container maxWidth="xs" sx={{ height: "100%" }} data-testid={DATA_TEST_ID.REGISTER_CONTAINER}>
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent={"space-evenly"}
        gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
        height={"80%"}
        width={"100%"}
      >
        <AuthHeader title={"Welcome to Compass!"} subtitle={"We need some information to get started"} />
        <Typography variant="subtitle2">Enter your registration code to sign up</Typography>
        <TextField
          fullWidth
          label="Registration code"
          variant="outlined"
          required
          value={registrationCode}
          onChange={(e) => handleRegistrationCodeChanged(e)}
          inputProps={{ "data-testid": DATA_TEST_ID.REGISTRATION_CODE_INPUT }}
        />
        <Divider textAlign="center" style={{ width: "100%" }}>
          <Typography variant="subtitle2" padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
            and then continue with
          </Typography>
        </Divider>
        <RegisterWithEmailForm
          disabled={!registrationCode}
          notifyOnRegister={handleRegister}
          isRegistering={isRegisterLoading}
        />
        <SocialAuth
          preLoginCheck={isInvitationCodeValid}
          postLoginHandler={successfulSocialRegistrationCallback}
          isLoading={isLoading}
          disabled={!registrationCode}
          label={"Sign up with Google"}
        />
        <Typography variant="body2" data-testid={DATA_TEST_ID.LOGIN_LINK}>
          Already have an account?{" "}
          <StyledNavLink
            to={routerPaths.LOGIN}
            style={{
              color: theme.palette.text.textAccent,
              fontStyle: "italic",
            }}
          >
            Login
          </StyledNavLink>
        </Typography>
      </Box>
    </Container>
  );
};

export default Register;
