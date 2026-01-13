import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Container, Divider, Typography, useTheme } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import SocialAuth from "src/auth/components/SocialAuth/SocialAuth";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import RegisterWithEmailForm from "src/auth/pages/Register/components/RegisterWithEmailForm/RegisterWithEmailForm";
import AuthHeader from "src/auth/components/AuthHeader/AuthHeader";
import InvitationCodeField from "src/auth/components/InvitationCodeField";
import { FirebaseError, getUserFriendlyFirebaseErrorMessage } from "src/error/FirebaseError/firebaseError";
import FirebaseEmailAuthService from "src/auth/services/FirebaseAuthenticationService/emailAuth/FirebaseEmailAuthentication.service";
import { getUserFriendlyErrorMessage, RestAPIError } from "src/error/restAPIError/RestAPIError";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import BugReportButton from "src/feedback/bugReport/bugReportButton/BugReportButton";
import FirebaseSocialAuthenticationService from "src/auth/services/FirebaseAuthenticationService/socialAuth/FirebaseSocialAuthentication.service";
import RequestInvitationCode from "src/auth/components/requestInvitationCode/RequestInvitationCode";
import { InvitationType } from "src/auth/services/invitationsService/invitations.types";
import CustomLink from "src/theme/CustomLink/CustomLink";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import { INVITATIONS_PARAM_NAME } from "src/auth/auth.types";
import { getApplicationRegistrationCode, getSocialAuthDisabled } from "src/envService";
import { REGISTRATION_CODE_FIELD_LABEL, REGISTRATION_CODE_QUERY_PARAM, REGISTRATION_CODE_TOAST_ID, REPORT_TOKEN_QUERY_PARAM } from "src/config/registrationCode";
import { invitationsService } from "src/auth/services/invitationsService/invitations.service";
import { InvitationStatus } from "src/auth/services/invitationsService/invitations.types";
import { registrationStore } from "src/state/registrationStore";
import { GTMService } from "src/utils/analytics/gtmService";

const uniqueId = "ab02918f-d559-47ba-9662-ea6b3a3606d0";

export const DATA_TEST_ID = {
  REGISTRATION_CODE_INPUT: `register-registration-code-input-${uniqueId}`,
  REGISTER_CONTAINER: `register-container-${uniqueId}`,
  LOGO: `register-logo-${uniqueId}`,
  TITLE: `register-title-${uniqueId}`,
  SUBTITLE: `register-subtitle-${uniqueId}`,
  FORM: `register-form-${uniqueId}`,
  USERNAME_INPUT: `register-username-input-${uniqueId}`,
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
  const initialRegistration = registrationStore.hydrateFromStorage();
  const [registrationCode, setRegistrationCode] = useState<string>(initialRegistration.code ?? "");
  const [reportToken, setReportToken] = useState<string | undefined>(initialRegistration.reportToken);
  const [codeLocked, setCodeLocked] = useState<boolean>(initialRegistration.locked);
  const [codeStatus, setCodeStatus] = useState<InvitationStatus | null>(null);
  const theme = useTheme();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const firstVisitTracked = useRef(false);

  const applicationRegistrationCode = useMemo(() => {
    return getApplicationRegistrationCode();
  }, []);

  // Check for registration code in URL params when component mounts
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const linkCodeParam = params.get(REGISTRATION_CODE_QUERY_PARAM);
    const linkReportToken = params.get(REPORT_TOKEN_QUERY_PARAM) ?? params.get("token") ?? undefined;
    const inviteCodeParam = params.get(INVITATIONS_PARAM_NAME) ?? params.get("invite-code");

    if (linkCodeParam || inviteCodeParam) {
      const nextState = linkCodeParam
        ? registrationStore.setLinkCode(linkCodeParam, linkReportToken)
        : registrationStore.setManualCode(inviteCodeParam);
      setRegistrationCode(nextState.code ?? "");
      setReportToken(nextState.reportToken);
      setCodeLocked(nextState.locked);
      setCodeStatus(null);
      const newSearchParams = new URLSearchParams(location.search);
      newSearchParams.delete(REGISTRATION_CODE_QUERY_PARAM);
      newSearchParams.delete(REPORT_TOKEN_QUERY_PARAM);
      newSearchParams.delete("token");
      newSearchParams.delete(INVITATIONS_PARAM_NAME);
      newSearchParams.delete("invite-code");
      navigate(
        {
          pathname: location.pathname,
          search: newSearchParams.toString(),
        },
        { replace: true }
      );
      return;
    }

    // hydrate from storage if no new code provided
    const hydrated = registrationStore.hydrateFromStorage();
    if (hydrated.code) {
      setRegistrationCode(hydrated.code ?? "");
      setReportToken(hydrated.reportToken);
      setCodeLocked(hydrated.locked);
      setCodeStatus(null);
    }
  }, [location, navigate]);

  useEffect(() => {
    if (firstVisitTracked.current) {
      return;
    }
    firstVisitTracked.current = true;
    const activeCode = registrationCode || applicationRegistrationCode || null;
    const source = codeLocked ? "secure_link" : activeCode ? "manual" : "unknown";
    GTMService.trackRegistrationVisit(activeCode, source);
  }, [registrationCode, applicationRegistrationCode, codeLocked]);

  // a state to determine if the user is currently registering with email
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { enqueueSnackbar } = useSnackbar();

  const handleError = useCallback(
    async (error: Error) => {
      let errorMessage;
      if (error instanceof RestAPIError) {
        console.error(error);
        errorMessage = getUserFriendlyErrorMessage(error);
      } else if (error instanceof FirebaseError) {
        errorMessage = getUserFriendlyFirebaseErrorMessage(error);
        if (error.errorCode === FirebaseErrorCodes.INVALID_REGISTRATION_CODE) {
          console.error(error);
        } else {
          console.warn(error);
        }
      } else {
        console.error(error);
        errorMessage = error.message;
      }
      enqueueSnackbar(t("auth.errors.registerFailedWithMessage", { message: errorMessage }), { variant: "error" });
    },
    [enqueueSnackbar, t]
  );

  const socialAuthDisabled = useMemo(() => {
    return getSocialAuthDisabled().toLowerCase() === "true";
  }, []);

  /* -----------
   * callbacks to pass to the child components
   */
  const handleRegistrationCodeChanged = (value: string) => {
    if (codeLocked) {
      return;
    }
    const updatedState = registrationStore.setManualCode(value || null);
    setRegistrationCode(updatedState.code ?? "");
    setReportToken(updatedState.reportToken);
    setCodeLocked(updatedState.locked);
    setCodeStatus(null);
  };

  const validateCode = useCallback(async () => {
    const codeToUse = registrationCode || applicationRegistrationCode;
    if (!codeToUse) {
      throw new Error(t("auth.errors.firebase.invalidRegistrationCode"));
    }
    const response = await invitationsService.checkInvitationCodeStatus(codeToUse, codeLocked ? reportToken : undefined);
    setCodeStatus(response.status);
    if (response.status !== InvitationStatus.VALID) {
      throw new Error(t("auth.errors.firebase.invalidRegistrationCode"));
    }
    if (!codeLocked) {
      enqueueSnackbar(`${t("auth.pages.register.registrationCode")}: ${codeToUse}`, {
        variant: "success",
        key: REGISTRATION_CODE_TOAST_ID,
      });
    }
    return { codeToUse, reportTokenToUse: codeLocked ? reportToken : undefined } as const;
  }, [registrationCode, applicationRegistrationCode, enqueueSnackbar, t, reportToken, codeLocked]);

  useEffect(() => {
    if (codeLocked && registrationCode) {
      validateCode().catch(async (error) => {
        await handleError(error as Error);
      });
    }
  }, [codeLocked, registrationCode, validateCode, handleError]);

  /**
   * Handles what happens after social registration (same process as login)
   * @param user
   */
  const handlePostLogin = useCallback(async () => {
    try {
      setIsLoading(true);
      const prefs = UserPreferencesStateService.getInstance().getUserPreferences();
      if (!prefs?.accepted_tc || isNaN(prefs?.accepted_tc.getTime())) {
        navigate(routerPaths.CONSENT, { replace: true });
      } else {
  navigate(routerPaths.ROOT, { replace: true });
  enqueueSnackbar(t("auth.pages.login.welcomeBack"), { variant: "success" });
      }
    } catch (error) {
      const firebaseSocialAuthServiceInstance = FirebaseSocialAuthenticationService.getInstance();
      await firebaseSocialAuthServiceInstance.logout(); // this does not throw an error, at least in the current implementation
      console.info("Social registration failed. Logging out user.");

      await handleError(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [navigate, enqueueSnackbar, handleError, t]);

  /* ------------
   * Actual registration handlers
   */
  /**
   * Handle the register form submission
   * @param email
   * @param password
   */
  const handleRegister = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const firebaseEmailAuthServiceInstance = FirebaseEmailAuthService.getInstance();
        const { codeToUse, reportTokenToUse } = await validateCode();
        // We're using the mail as the username for now, since we don't have any use case in the app for it
        await firebaseEmailAuthServiceInstance.register(email, password, email, codeToUse, reportTokenToUse);
        GTMService.trackRegistrationComplete("email", codeToUse || null);
  enqueueSnackbar(t("auth.verificationEmailSentShort"), { variant: "success" });
        // IMPORTANT NOTE: after the preferences are added, or fail to be added, we should log the user out immediately,
        // since if we don't do that, the user may be able to access the application without verifying their email
        // or accepting the dpa.
        await firebaseEmailAuthServiceInstance.logout();
        console.info("Registration requires email verification. Logging out user.");

        // navigate to the verify email page
        navigate(routerPaths.VERIFY_EMAIL, { replace: true });
      } catch (e) {
        await handleError(e as Error);
      } finally {
        setIsLoading(false);
      }
    },
    [navigate, enqueueSnackbar, setIsLoading, handleError, validateCode, t]
  );

  /**
   * A callback function for the social auth component to set the loading state
   */
  const notifyOnSocialLoading = useCallback((socialAuthLoading: boolean) => {
    setIsLoading(socialAuthLoading);
  }, []);

  return (
    <Container
      maxWidth="xs"
      sx={{ height: "100%", padding: theme.fixedSpacing(theme.tabiyaSpacing.lg) }}
      data-testid={DATA_TEST_ID.REGISTER_CONTAINER}
    >
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent={"space-evenly"}
        gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
        width={"100%"}
      >
        <AuthHeader
          title={t("auth.pages.login.welcomeTitle")}
          subtitle={
            <Typography variant="body2" gutterBottom>
              {t("auth.pages.register.subtitle")}
            </Typography>
          }
        />
        {!applicationRegistrationCode && (
          <React.Fragment>
            <Typography variant="subtitle2">{t("auth.pages.register.enterRegistrationCode")}</Typography>
            <InvitationCodeField
              value={registrationCode}
              locked={codeLocked}
              label={t("auth.pages.register.registrationCode") || REGISTRATION_CODE_FIELD_LABEL}
              onChange={handleRegistrationCodeChanged}
              dataTestId={DATA_TEST_ID.REGISTRATION_CODE_INPUT}
            />
          </React.Fragment>
        )}
        {!applicationRegistrationCode && (
          <Divider textAlign="center" style={{ width: "100%" }}>
            <Typography variant="subtitle2" padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
              {t("auth.pages.register.andEitherContinueWith")}
            </Typography>
          </Divider>
        )}
        <RegisterWithEmailForm
          disabled={!registrationCode && !applicationRegistrationCode || codeStatus === InvitationStatus.INVALID || codeStatus === InvitationStatus.USED}
          notifyOnRegister={handleRegister}
          isRegistering={isLoading}
        />
        {!socialAuthDisabled && (
          <SocialAuth
            postLoginHandler={handlePostLogin}
            isLoading={isLoading}
            disabled={!registrationCode && !applicationRegistrationCode || codeStatus === InvitationStatus.INVALID || codeStatus === InvitationStatus.USED}
            label={t("auth.pages.register.registerWithGoogle")}
            notifyOnLoading={notifyOnSocialLoading}
            registrationCode={registrationCode || applicationRegistrationCode}
            reportToken={codeLocked ? reportToken : undefined}
          />
        )}
        <Typography variant="caption" data-testid={DATA_TEST_ID.LOGIN_LINK}>
          {t("auth.pages.register.alreadyHaveAccount")} <CustomLink onClick={() => navigate(routerPaths.LOGIN)}>{t("common.buttons.login")}</CustomLink>
        </Typography>
        {!applicationRegistrationCode && <RequestInvitationCode invitationCodeType={InvitationType.REGISTER} />}
      </Box>
      <BugReportButton bottomAlign={true} />
      <Backdrop isShown={isLoading} message={t("auth.pages.register.registeringYou")} />
    </Container>
  );
};

export default Register;
