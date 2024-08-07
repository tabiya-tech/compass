import React, { useCallback, useContext, useState } from "react";
import { Box, Container, Divider, styled, TextField, Typography, useTheme } from "@mui/material";
import { EmailAuthContext, TabiyaUser } from "src/auth/emailAuth/EmailAuthProvider/EmailAuthProvider";
import { NavLink as RouterNavLink } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import IDPAuth from "src/auth/components/IDPAuth/IDPAuth";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import RegisterWithEmailForm from "src/auth/pages/Register/components/RegisterWithEmailForm/RegisterWithEmailForm";
import AuthHeader from "src/auth/components/AuthHeader/AuthHeader";
import { FirebaseError, getUserFriendlyFirebaseErrorMessage } from "src/error/FirebaseError/firebaseError";
import { writeFirebaseErrorToLog } from "src/error/FirebaseError/logger";
import { invitationsService } from "src/invitations/InvitationsService/invitations.service";
import { InvitationStatus, InvitationType } from "src/invitations/InvitationsService/invitations.types";
import { userPreferencesService } from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { Language } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { getUserFriendlyErrorMessage, ServiceError } from "../../../error/ServiceError/ServiceError";
import { writeServiceErrorToLog } from "../../../error/ServiceError/logger";

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
  // we have to pass the notifyOnLogin function since the IDPAuth component is used in the Register component
  // and the IDPAuth behaves like a login
  postLoginHandler: (user: TabiyaUser) => void;
  // describes the loading state of the post login handlers
  isPostLoginLoading: boolean;
}

const Register: React.FC<Readonly<RegisterProps>> = ({ postRegisterHandler, postLoginHandler, isPostLoginLoading }) => {
  const [registrationCode, setRegistrationCode] = useState<string>("");

  const theme = useTheme();
  const { registerWithEmail } = useContext(EmailAuthContext);
  const [isRegisteringWithEmail, setIsRegisteringWithEmail] = useState<boolean>(false);

  const { enqueueSnackbar } = useSnackbar();

  const isInvitationCodeValid = useCallback(async () => {
    try {
      // Check if the invitation code is valid
      const invitation_status = await invitationsService.checkInvitationCodeStatus(registrationCode);

      if(invitation_status.status === InvitationStatus.INVALID){
        enqueueSnackbar("Invalid invitation code", { variant: "error" });
        return false;
      }

      if(invitation_status.invitation_type !== InvitationType.REGISTER){
        enqueueSnackbar("Invalid invitation code", { variant: "error" });
        return false;
      }

      return true;
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
  const handleRegister = useCallback( async (name: string, email: string, password: string) => {
    setIsRegisteringWithEmail(true);
    const pass = await isInvitationCodeValid();

    if(!pass) {
      setIsRegisteringWithEmail(false);
      return;
    }

    registerWithEmail(
      registrationCode,
      email,
      password,
      name,
      () => {
        postRegisterHandler();
        setIsRegisteringWithEmail(false);
        enqueueSnackbar("Verification Email Sent!", { variant: "success" });
      },
      (e) => {
        let errorMessage;
        if (e instanceof FirebaseError) {
          errorMessage = getUserFriendlyFirebaseErrorMessage(e);
          writeFirebaseErrorToLog(e, console.error);
        } else {
          console.error(e);
          errorMessage = (e as Error).message;
        }
        setIsRegisteringWithEmail(false);
        enqueueSnackbar(errorMessage, { variant: "error" });
      }
    );
  }, [registerWithEmail, postRegisterHandler, isInvitationCodeValid, registrationCode, enqueueSnackbar]);

  const postIDPRegisterHandler = async (user: TabiyaUser) => {
    try {
      await userPreferencesService.createUserPreferences({
        user_id: user.id,
        invitation_code: registrationCode,
        language: Language.en,
      })

      postLoginHandler(user);
    } catch (e) {
      if (e instanceof ServiceError) {
        writeServiceErrorToLog(e, console.error);
      } else {
        console.error(e);
      }
      const errorMessage = getUserFriendlyErrorMessage(e as Error);
      enqueueSnackbar(errorMessage, { variant: "error" });
    }
  }

  const registrationCodeChangeHandler = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setRegistrationCode(event.target.value);
  }

  return (
    <Container maxWidth="xs" sx={{ height: "100%" }} data-testid={DATA_TEST_ID.REGISTER_CONTAINER}>
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent={"space-evenly"}
        m={4}
        height={"80%"}
      >
        <AuthHeader title={"Welcome to Compass!"} subtitle={"We need some information to get started"} />
        <Typography fontWeight="bold" textAlign="left" width={"100%"} mt={3}>
          Enter your registration code to sign up
        </Typography>
        <TextField
          fullWidth
          label="Registration code"
          variant="outlined"
          margin="normal"
          required
          value={registrationCode}
          onChange={e => registrationCodeChangeHandler(e)}
          inputProps={{ "data-testid": DATA_TEST_ID.REGISTRATION_CODE_INPUT }}
        />
        <Divider textAlign="center" style={{ width: "100%"}}>And continue with</Divider>
        <RegisterWithEmailForm
          disabled={!registrationCode}
          notifyOnRegister={handleRegister}
          isRegistering={isRegisteringWithEmail || isPostLoginLoading}
        />
        <IDPAuth
          preLoginCheck={isInvitationCodeValid}
          notifyOnLogin={postIDPRegisterHandler}
          isLoading={isPostLoginLoading}
          disabled={!registrationCode}
          label={"Sign up with Google"}
        />
        <Typography variant="body2" mt={2} data-testid={DATA_TEST_ID.LOGIN_LINK}>
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
