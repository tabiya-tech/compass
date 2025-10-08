import React, { useState, useCallback, useContext, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  TextField,
  CircularProgress,
  useTheme,
  styled,
  useMediaQuery,
  Theme
} from "@mui/material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import CloseIcon from "@mui/icons-material/Close";
import PasswordInput from "src/theme/PasswordInput/PasswordInput";
import FirebaseEmailAuthenticationService from "src/auth/services/FirebaseAuthenticationService/emailAuth/FirebaseEmailAuthentication.service";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

const uniqueId = "a4b3c2d1-e5f6-4g7h-8i9j-0k1l2m3n4o5p";

const HighlightedSpan = styled("span")(({ theme }) => ({
  backgroundColor: theme.palette.tabiyaYellow.light,
}));

export const DATA_TEST_ID = {
  DIALOG: `anonymous-account-conversion-dialog-${uniqueId}`,
  EMAIL_INPUT: `anonymous-account-conversion-email-${uniqueId}`,
  EMAIL_CONFIRMATION_INPUT: `anonymous-account-conversion-email-confirmation-${uniqueId}`,
  PASSWORD_INPUT: `anonymous-account-conversion-password-${uniqueId}`,
  SUBMIT_BUTTON: `anonymous-account-conversion-submit-${uniqueId}`,
  CLOSE_ICON: `anonymous-account-conversion-close-${uniqueId}`,
};

interface AnonymousAccountConversionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const style = {
  width: "100%",
  backgroundColor: "background.paper",
  boxShadow: 24,
  borderRadius: 1
};

const AnonymousAccountConversionDialog: React.FC<AnonymousAccountConversionDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isOnline = useContext(IsOnlineContext);
  const [email, setEmail] = useState("");
  const [emailConfirmation, setEmailConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));

  useEffect(() => {
    const personalInfo = PersistentStorageService.getPersonalInfo();
    if (personalInfo?.contactEmail) {
      setEmail(personalInfo.contactEmail);
    }
  }, []);

  const isEmailValid = useMemo(() => {
    return email && 
           emailConfirmation && 
           email === emailConfirmation && 
           validateEmail(email);
  }, [email, emailConfirmation]);

  const isFormValid = isEmailValid && isPasswordValid;

  const handleSubmit = useCallback(async () => {
    if (!validateEmail(email)) {
      enqueueSnackbar("Please enter a valid email address", { variant: "error" });
      return;
    }

    if (!isEmailValid) {
      enqueueSnackbar("Please ensure both email addresses match", { variant: "error" });
      return;
    }

    if (!isPasswordValid) {
      enqueueSnackbar("Please ensure your password meets all requirements", { variant: "error" });
      return;
    }

    setIsLoading(true);
    try {
      const authService = FirebaseEmailAuthenticationService.getInstance();
      await authService.linkAnonymousAccount(email, password, email);
      enqueueSnackbar("Account successfully registered!", { variant: "success" });
      enqueueSnackbar(`Currently logged in with the email: ${email}. A verification email has been sent to your email address. Please verify your account before logging in again.`, {
        variant: "info",
        persist: true,
        autoHideDuration: null
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      enqueueSnackbar(error.message || "Failed to register account", { variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [email, password, onSuccess, onClose, enqueueSnackbar, isEmailValid, isPasswordValid]);

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      data-testid={DATA_TEST_ID.DIALOG}
      maxWidth="sm"
      fullWidth={true}
      fullScreen={isSmallMobile}
      PaperProps={{ sx: style }}
    >
      <PrimaryIconButton
        data-testid={DATA_TEST_ID.CLOSE_ICON}
        title={t("close_registration_form")}
        onClick={onClose}
        sx={{
          position: "absolute",
          right: 8,
          top: 8,
          color: (theme) => theme.palette.grey[500],
        }}
      >
        <CloseIcon />
      </PrimaryIconButton>
      
      <DialogTitle>
        <Typography variant="h4" component="div" gutterBottom>
          {t("register_account")}
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        <Typography variant="body2" gutterBottom>
           {t("registration_info")}
        </Typography>
        
        <HighlightedSpan>{t("email_warning")}</HighlightedSpan>
        <Box sx={{ mt: 2 }}>
          <TextField
            autoFocus
            fullWidth
            label={t("email")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid={DATA_TEST_ID.EMAIL_INPUT}
            margin="normal"
            required
            error={email !== "" && !validateEmail(email)}
            helperText={email !== "" && !validateEmail(email) ? "Please enter a valid email address" : ""}
          />
          
          <TextField
            fullWidth
            label={t("confirm_email")}
            type="email"
            value={emailConfirmation}
            onChange={(e) => setEmailConfirmation(e.target.value)}
            data-testid={DATA_TEST_ID.EMAIL_CONFIRMATION_INPUT}
            margin="normal"
            required
            error={emailConfirmation !== "" && email !== emailConfirmation}
            helperText={emailConfirmation !== "" && email !== emailConfirmation ? "Emails do not match" : ""}
          />
          
          <PasswordInput
            fullWidth
            label={t("password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid={DATA_TEST_ID.PASSWORD_INPUT}
            margin="normal"
            required
            onValidityChange={setIsPasswordValid}
          />
        </Box>
        
        <Box sx={{ mt: 3 }}>
          <PrimaryButton
            onClick={handleSubmit}
            fullWidth
            disableWhenOffline
            disabled={isLoading || !isFormValid || !isOnline}
            data-testid={DATA_TEST_ID.SUBMIT_BUTTON}
          >
            {isLoading ? (
              <CircularProgress
                sx={{ color: (theme) => theme.palette.info.contrastText }}
                size={2 * theme.typography.fontSize}
              />
            ) : (
              t("register")
            )}
          </PrimaryButton>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default AnonymousAccountConversionDialog; 
