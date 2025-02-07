import React, { useState, useCallback, useEffect, useContext } from "react";
import { Box, Typography, styled } from "@mui/material";
import FirebaseEmailAuthService from "src/auth/services/FirebaseAuthenticationService/emailAuth/FirebaseEmailAuthentication.service";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { FirebaseError, getUserFriendlyFirebaseErrorMessage } from "src/error/FirebaseError/firebaseError";
import { writeFirebaseErrorToLog } from "src/error/FirebaseError/logger";
import CustomLink from "src/theme/CustomLink/CustomLink";
import { IsOnlineContext } from "../../../app/isOnlineProvider/IsOnlineProvider";

const uniqueId = "e8f3b9a2-1d4c-4f5e-9c7b-8d2a6b4e5f3c";

export const DATA_TEST_ID = {
  CONTAINER: `resend-verification-email-container-${uniqueId}`,
  RESEND_LINK: `resend-verification-email-button-${uniqueId}`,
  TIMER: `resend-verification-email-timer-${uniqueId}`,
};

const StyledBox = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: theme.spacing(1),
  marginTop: theme.spacing(2),
}));

interface ResendVerificationEmailProps {
  email: string;
  password: string;
  // Optional props for testing
  initialIsLoading?: boolean;
  initialCooldownSeconds?: number;
}

export const COOLDOWN_SECONDS = 60;

const ResendVerificationEmail: React.FC<ResendVerificationEmailProps> = ({ 
  email, 
  password, 
  initialIsLoading = false,
  initialCooldownSeconds = 0 
}) => {
  const [isLoading, setIsLoading] = useState(initialIsLoading);
  const [cooldownSeconds, setCooldownSeconds] = useState(initialCooldownSeconds);
  const { enqueueSnackbar } = useSnackbar();
  const isOnline = useContext(IsOnlineContext);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldownSeconds > 0) {
      timer = setInterval(() => {
        setCooldownSeconds((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [cooldownSeconds]);

  const handleResendVerificationEmail = useCallback(async () => {
    setIsLoading(true);
    try {
      const firebaseEmailAuthServiceInstance = FirebaseEmailAuthService.getInstance();
      await firebaseEmailAuthServiceInstance.resendVerificationEmail(email, password);
      enqueueSnackbar("Verification email sent successfully", { variant: "success" });
      setCooldownSeconds(COOLDOWN_SECONDS);
    } catch (error) {
      let errorMessage;
      if (error instanceof FirebaseError) {
        errorMessage = getUserFriendlyFirebaseErrorMessage(error);
        writeFirebaseErrorToLog(error, console.warn);
      } else {
        errorMessage = (error as Error).message;
        console.error(error);
      }
      enqueueSnackbar(`Failed to send verification email: ${errorMessage}`, { variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [email, password, enqueueSnackbar]);

  return (
    <StyledBox data-testid={DATA_TEST_ID.CONTAINER}>
      <Typography variant="body2" color="textSecondary">
        Your email is not verified. Please check your inbox for the verification email.
      </Typography>
      <Box>
        <CustomLink
          onClick={handleResendVerificationEmail}
          disabled={isLoading || cooldownSeconds > 0 || !isOnline}
          data-testid={DATA_TEST_ID.RESEND_LINK}
        >
          Resend verification email
        </CustomLink>
        {cooldownSeconds > 0 && (
          <Typography
            variant="caption"
            color="textSecondary"
            component="span"
            sx={{ ml: theme => theme.spacing(theme.tabiyaSpacing.xs) }}
            data-testid={DATA_TEST_ID.TIMER}
          >
            ({cooldownSeconds}s)
          </Typography>
        )}
      </Box>
    </StyledBox>
  );
};

export default ResendVerificationEmail; 