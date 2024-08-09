import React, { useCallback, useContext, useState } from "react";
import { Box, Container, Divider, styled, TextField, Typography, useTheme } from "@mui/material";
import { NavLink as RouterNavLink } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import SocialAuth from "src/auth/components/SocialAuth/SocialAuth";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import RegisterWithEmailForm from "src/auth/pages/Register/components/RegisterWithEmailForm/RegisterWithEmailForm";
import AuthHeader from "src/auth/components/AuthHeader/AuthHeader";
import { getUserFriendlyFirebaseErrorMessage } from "src/error/FirebaseError/firebaseError";
import { writeFirebaseErrorToLog } from "src/error/FirebaseError/logger";
import { AuthContext, TabiyaUser } from "src/auth/AuthProvider";
import { emailAuthService } from "src/auth/services/emailAuth/EmailAuth.service";
import { invitationsService } from "src/invitations/InvitationsService/invitations.service";
import { InvitationStatus, InvitationType } from "src/invitations/InvitationsService/invitations.types";
import { userPreferencesService } from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { Language } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { getUserFriendlyErrorMessage, ServiceError } from "src/error/ServiceError/ServiceError";
import { writeServiceErrorToLog } from "src/error/ServiceError/logger";
import { logoutService } from "../../services/logout/logout.service";
import { UserPreferencesContext } from "../../../userPreferences/UserPreferencesProvider/UserPreferencesProvider";

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

export interface RegisterProps {
  postRegisterHandler: () => void;
  // we have to pass the notifyOnLogin function since the SocialAuth component is used in the Register component
  // and the SocialAuth behaves like a login
  postLoginHandler: (user: TabiyaUser) => void;
  // describes the loading state of the post login handlers
  isPostLoginLoading: boolean;
}

const Register: React.FC<Readonly<RegisterProps>> = ({ postRegisterHandler, postLoginHandler, isPostLoginLoading }) => {
  const [registrationCode, setRegistrationCode] = useState<string>("");

  const theme = useTheme();
  const { isAuthenticationInProgress, updateUserByToken } = useContext(AuthContext);
  const { updateUserPreferences } = useContext(UserPreferencesContext);

  const [isRegisteringWithEmail, setIsRegisteringWithEmail] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const isInvitationCodeValid = useCallback(async (): Promise<boolean> => {
    try {
      return await new Promise<boolean>((resolve) => {
        // Call the service method and use callbacks to determine the result
        invitationsService.checkInvitationCodeStatus(
          registrationCode,
          (invitation) => {
            if (
              invitation.status === InvitationStatus.INVALID ||
              invitation.invitation_type !== InvitationType.REGISTER
            ) {
              enqueueSnackbar("Invalid invitation code", { variant: "error" });
              resolve(false);
            } else {
              resolve(true);
            }
          },
          (error) => {
            const errorMessage = getUserFriendlyErrorMessage(error);
            enqueueSnackbar(errorMessage, { variant: "error" });
            resolve(false);
          }
        );
      });
    } catch (e) {
      if (e instanceof ServiceError) {
        writeServiceErrorToLog(e, console.error);
      } else {
        console.error(e);
      }
      const errorMessage = getUserFriendlyErrorMessage(e as Error);
      enqueueSnackbar(errorMessage, { variant: "error" });
      return false;
    }
  }, [enqueueSnackbar, registrationCode]);

  /**
   * Handle the register form submission
   * @param name
   * @param email
   * @param password
   */
  const handleRegister = useCallback(
    async (name: string, email: string, password: string) => {
      setIsRegisteringWithEmail(true);
      const pass = await isInvitationCodeValid();

      if (!pass) {
        setIsRegisteringWithEmail(false);
        return;
      }
      emailAuthService.handleRegisterWithEmail(
        email,
        password,
        name,
        async (token) => {
          const _user = updateUserByToken(token);
          if (_user) {
            try {
              // create user preferences for the first time.
              // in order to do this, there needs to be a logged in user in the persistent storage
              await userPreferencesService.createUserPreferences(
                {
                  user_id: _user.id,
                  invitation_code: registrationCode,
                  language: Language.en,
                },
                (prefs) => {
                  updateUserPreferences(prefs);
                  setIsRegisteringWithEmail(false);
                  enqueueSnackbar("Verification Email Sent!", { variant: "success" });
                  postRegisterHandler();
                },
                (error) => {
                  setIsRegisteringWithEmail(false);
                  writeServiceErrorToLog(error, console.error);
                  enqueueSnackbar("Failed to create user preferences", { variant: "error" });
                }
              );
              // IMPORTANT NOTE: after the preferences are added, or fail to be added, we should log the user out immediately,
              // since if we don't do that, the user may be able to access the application without verifying their email
              // or accepting the dpa.
              await logoutService.handleLogout(
                () => {
                  // do nothing
                },
                (error) => {
                  console.error(error);
                }
              );
            } catch (e: any) {
              if (e instanceof ServiceError) {
                writeServiceErrorToLog(e, console.error);
              } else {
                console.error(e);
              }
              const errorMessage = getUserFriendlyErrorMessage(e as Error);
              enqueueSnackbar(errorMessage, { variant: "error" });
            }
          }
        },
        (e) => {
          setIsRegisteringWithEmail(false);
          let errorMessage;
          errorMessage = getUserFriendlyFirebaseErrorMessage(e);
          writeFirebaseErrorToLog(e, console.error);
          enqueueSnackbar(errorMessage, { variant: "error" });
        }
      );
    },
    [
      enqueueSnackbar,
      setIsRegisteringWithEmail,
      postRegisterHandler,
      isInvitationCodeValid,
      registrationCode,
      updateUserByToken,
      updateUserPreferences,
    ]
  );

  const postIDPRegisterHandler = async (user: TabiyaUser) => {
    try {
      await userPreferencesService.createUserPreferences(
        {
          user_id: user.id,
          invitation_code: registrationCode,
          language: Language.en,
        },
        (prefs) => {
          updateUserPreferences(prefs);
          postLoginHandler(user);
        },
        (error) => {
          // @ts-ignore
          if(error?.details?.statusCode === 409) {
            postLoginHandler(user);
            return;
          }

          writeServiceErrorToLog(error, console.error);
          enqueueSnackbar("Failed to create user preferences", { variant: "error" });
        }
      );
    } catch (e: any) {
      if(e.statusCode === 409) {
        postLoginHandler(user);
        return;
      }

      if (e instanceof ServiceError) {
        writeServiceErrorToLog(e, console.error);
      } else {
        console.error(e);
      }
      const errorMessage = getUserFriendlyErrorMessage(e as Error);
      enqueueSnackbar(errorMessage, { variant: "error" });
    }
  };

  const registrationCodeChangeHandler = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setRegistrationCode(event.target.value);
  };

  // register form is in the loading state if the auth context is loading, or if the user is registering with email or the post login handler is loading
  const isRegisterLoading = isAuthenticationInProgress || isRegisteringWithEmail || isPostLoginLoading;

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
          onChange={(e) => registrationCodeChangeHandler(e)}
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
          postLoginHandler={postIDPRegisterHandler}
          isLoading={isPostLoginLoading}
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
