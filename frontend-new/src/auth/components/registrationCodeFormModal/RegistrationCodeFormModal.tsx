import React, { useCallback, useState } from "react";
import * as Sentry from "@sentry/react";
import Modal from "@mui/material/Modal";

import { Box, CircularProgress, TextField, Typography, useTheme } from "@mui/material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import CloseIcon from "@mui/icons-material/Close";
import RequestInvitationCodeFormModal from "src/auth/components/requestInvitationCode/requestInvitationCodeFormModal/RequestInvitationCodeFormModal";
import CustomLink from "src/theme/CustomLink/CustomLink";

export enum RegistrationCodeFormModalState {
  SHOW,
  HIDE,
  LOADING,
}

const uniqueId = "f782907a-6904-482c-b148-3c6682bf7b54";

/**
 * Data test ids for the component
 */
export const DATA_TEST_ID = {
  CONTAINER: `invitation-code-form-modal-container-${uniqueId}`,
  INVITATION_CODE_INPUT: `invitation-code-input-${uniqueId}`,
  MODAL_TITLE: `invitation-code-modal-title-${uniqueId}`,
  MODAL_SUBTITLE: `invitation-code-modal-subtitle-${uniqueId}`,
  SUBMIT_BUTTON: `invitation-code-submit-button-${uniqueId}`,
  PROGRESS_ELEMENT: `invitation-code-progress-element-${uniqueId}`,
  CLOSE_ICON: `invitation-code-close-icon-${uniqueId}`,
  REQUEST_REGISTRATION_CODE_LINK: `invitation-code-request-registration-code-link-${uniqueId}`,
};

export interface InvitationCodeFormModalProps {
  /**
   * Whether the modal is modal state or not
   */
  modalState: RegistrationCodeFormModalState;
  /**
   * Function to call when the registration code is validated
   * @param registrationCode
   */
  onSuccess: (registrationCode: string) => void;
  onClose: () => void;
}

/**
 * Modal to enter the registration code
 */
const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  maxWidth: 400,
  width: "100%",
  bgcolor: "background.paper",
  boxShadow: 24,
  borderRadius: 1,
  p: 4,
  display: "flex",
  flexDirection: "column",
};

const RegistrationCodeFormModal: React.FC<InvitationCodeFormModalProps> = ({ modalState, onSuccess, onClose }) => {
  const theme = useTheme();
  const [registrationCode, setRegistrationCode] = useState("");
  const [isInvitationCodeRequestModalOpen, setIsInvitationCodeRequestModalOpen] = useState<boolean>(false);

  const handleAcceptRegistrationCode = useCallback(async () => {
    onSuccess(registrationCode);
  }, [onSuccess, registrationCode]);

  const handleOpenRequestModal = () => {
    onClose();
    setIsInvitationCodeRequestModalOpen(true);
  };


  return (
    <>
      <Modal
        open={
          modalState === RegistrationCodeFormModalState.SHOW || modalState === RegistrationCodeFormModalState.LOADING
        }
        onClose={onClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
        data-testid={DATA_TEST_ID.CONTAINER}
      >
        <Box sx={style}>
          <PrimaryIconButton
            data-testid={DATA_TEST_ID.CLOSE_ICON}
            title="Close registration code form"
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
          <Typography variant="h4" data-testid={DATA_TEST_ID.MODAL_TITLE}>
            Registration code
          </Typography>
          <Typography variant="body2" data-testid={DATA_TEST_ID.MODAL_SUBTITLE}>
            Enter your registration code
          </Typography>
          <TextField
            fullWidth
            label="Registration code"
            variant="outlined"
            placeholder={"Enter your registration code"}
            margin="normal"
            required
            onChange={(e) => setRegistrationCode(e.target.value)}
            inputProps={{ "data-testid": DATA_TEST_ID.INVITATION_CODE_INPUT }}
          />
          <PrimaryButton
            data-testid={DATA_TEST_ID.SUBMIT_BUTTON}
            fullWidth
            disableWhenOffline
            onClick={handleAcceptRegistrationCode}
            disabled={!registrationCode.length}
          >
            {modalState === RegistrationCodeFormModalState.LOADING ? (
              <CircularProgress
                sx={{ color: (theme) => theme.palette.info.contrastText }}
                size={2 * theme.typography.fontSize}
                data-testid={DATA_TEST_ID.PROGRESS_ELEMENT}
              />
            ) : (
              "Submit"
            )}
          </PrimaryButton>
          { Sentry.isInitialized() && <Typography
            variant="caption"
            sx={{
              textAlign: "center",
              marginTop: theme.fixedSpacing(theme.tabiyaSpacing.sm),
            }}
          >
            Don't have a registration code?{" "}
            <CustomLink onClick={handleOpenRequestModal} data-testid={DATA_TEST_ID.REQUEST_REGISTRATION_CODE_LINK}>
              Reach out
            </CustomLink>
          </Typography>
          }
        </Box>
      </Modal>
      <RequestInvitationCodeFormModal open={isInvitationCodeRequestModalOpen} onClose={() => setIsInvitationCodeRequestModalOpen(false)} />
    </>
  );
};

export default RegistrationCodeFormModal;
