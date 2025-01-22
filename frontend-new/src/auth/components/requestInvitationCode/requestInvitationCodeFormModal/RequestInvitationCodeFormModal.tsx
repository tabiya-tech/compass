import React, { useContext, useState } from "react";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { Box, Modal, TextField, Typography, useMediaQuery, useTheme } from "@mui/material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import CloseIcon from "@mui/icons-material/Close";
import { Theme } from "@mui/material/styles";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { requestInvitationCode } from "src/auth/components/requestInvitationCode/requestInvitationCodeService/SentryInvitationCodeRequest.service";

export interface RequestInvitationFormModalProps {
  open: boolean;
  onClose: () => void;
}

const uniqueId = "54e2f585-4c25-47d5-9414-928cb63d30cd";

export const DATA_TEST_ID = {
  CONTAINER: `request-invitation-code-form-modal-container-${uniqueId}`,
  CLOSE_ICON: `request-invitation-code-form-close-icon-${uniqueId}`,
  MODAL_TITLE: `request-invitation-code-form-modal-title-${uniqueId}`,
  MODAL_SUBTITLE: `request-invitation-code-form-modal-subtitle-${uniqueId}`,
  NAME_INPUT: `request-invitation-code-form-name-input-${uniqueId}`,
  EMAIL_INPUT: `request-invitation-code-form-email-input-${uniqueId}`,
  MESSAGE_INPUT: `request-invitation-code-form-message-input-${uniqueId}`,
  SUBMIT_BUTTON: `request-invitation-code-form-submit-button-${uniqueId}`,
};

const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  maxWidth: 400,
  width: "100%",
  backgroundColor: "background.paper",
  boxShadow: 24,
  borderRadius: 1,
  padding: (theme: Theme) => theme.fixedSpacing(theme.tabiyaSpacing.md),
};

const RequestInvitationCodeFormModal: React.FC<RequestInvitationFormModalProps> = ({ open, onClose }) => {
  const theme = useTheme();
  const isOnline = useContext(IsOnlineContext);
  const { enqueueSnackbar } = useSnackbar();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      requestInvitationCode({
        name,
        email,
        message,
      });

      enqueueSnackbar(
        "Your request for access to Compass has been submitted successfully. We will get back to you soon.",
        {
          variant: "success",
        }
      );
    } catch (e) {
      enqueueSnackbar("Something went wrong while attempting to send your request", {
        variant: "error",
      });
      console.error(e);
    }

    resetForm();
  };

  // Reset the form fields and close the modal
  const resetForm = () => {
    setName("");
    setEmail("");
    setMessage("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} data-testid={DATA_TEST_ID.CONTAINER}>
      <Box
        sx={{ ...style, padding: isSmallMobile ? theme.fixedSpacing(theme.tabiyaSpacing.md) : theme.tabiyaSpacing.lg }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="start">
          <Typography variant="h4" gutterBottom data-testid={DATA_TEST_ID.MODAL_TITLE}>
            Request access to Compass
          </Typography>
          <PrimaryIconButton
            title="Close request invitation code form"
            onClick={onClose}
            sx={{
              color: theme.palette.grey[500],
            }}
            data-testid={DATA_TEST_ID.CLOSE_ICON}
          >
            <CloseIcon />
          </PrimaryIconButton>
        </Box>
        <Typography variant="body2" data-testid={DATA_TEST_ID.MODAL_SUBTITLE}>
          Please let us know how you plan to use Compass. We will carefully review your request and contact you shortly.
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Name"
            placeholder="Name"
            type="text"
            variant="outlined"
            margin="normal"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            inputProps={{ "data-testid": DATA_TEST_ID.NAME_INPUT }}
          />
          <TextField
            fullWidth
            label="Email"
            placeholder="Email"
            type="email"
            variant="outlined"
            margin="normal"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputProps={{ "data-testid": DATA_TEST_ID.EMAIL_INPUT }}
          />
          <TextField
            fullWidth
            label="Message"
            placeholder="Please share how you plan to use Compass"
            variant="outlined"
            margin="normal"
            required
            multiline
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            inputProps={{ "data-testid": DATA_TEST_ID.MESSAGE_INPUT }}
          />
          <PrimaryButton
            type="submit"
            disableWhenOffline={true}
            fullWidth
            disabled={!name || !email || !message || !isOnline}
            data-testid={DATA_TEST_ID.SUBMIT_BUTTON}
          >
            Submit
          </PrimaryButton>
        </Box>
      </Box>
    </Modal>
  );
};

export default RequestInvitationCodeFormModal;
