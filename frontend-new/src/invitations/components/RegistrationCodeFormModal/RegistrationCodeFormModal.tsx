import React, { useCallback, useState } from "react";
import Modal from "@mui/material/Modal";

import { Box, TextField, Typography } from "@mui/material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import InvitationsService from "src/invitations/InvitationsService/invitations.service";
import { InvitationStatus, InvitationType } from "src/invitations/InvitationsService/invitations.types";

const uniqueId = "f782907a-6904-482c-b148-3c6682bf7b54";

/**
 * Data test ids for the component
 */
export const DATA_TEST_ID = {
  CONTAINER: `invitation-code-form-modal-container-${uniqueId}`,
  INVITATION_CODE_INPUT: `invitation-code-input-${uniqueId}`,
  MODAL_TITLE: `invitation-code-modal-title-${uniqueId}`,
  MODAL_SUBTITLE: `invitation-code-modal-subtitle-${uniqueId}`,
};

export interface InvitationCodeFormModalProps {
  /**
   * Whether the modal is shown or not
   */
  show: boolean;

  /**
   * Function to close the modal, Ideally this is to set the show prop to false
   */
  onClose: () => void;

  /**
   * Function to call when the registration code is validated
   * @param invitationCode
   */
  onSuccess: (invitationCode: string) => void;
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
};

const RegistrationCodeFormModal: React.FC<InvitationCodeFormModalProps> = ({ show, onClose, onSuccess }) => {
  const { enqueueSnackbar } = useSnackbar();

  const [invitationCode, setInvitationCode] = useState("");
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isValidated, setIsValidated] = useState<boolean>(false);

  const closeModal = useCallback(() => {
    /**
     * If the registration code is not validated, do not close the modal
     * This is to prevent the user from closing the modal without validating the registration code
     */
    if (!invitationCode || !isValidated) return;
    else onClose();
  }, [isValidated, onClose, invitationCode]);

  const validateRegistrationCode = useCallback(async () => {
    try {
      setIsValidating(true);
      const service = InvitationsService.getInstance();
      const invitation = await service.checkInvitationCodeStatus(invitationCode);
      if (invitation.status !== InvitationStatus.VALID || invitation.invitation_type !== InvitationType.REGISTER) {
        throw new Error("Invalid registration code");
      }
      enqueueSnackbar("Registration code is valid!", { variant: "success" });
      setIsValidated(true);
      onSuccess(invitation.invitation_code);
    } catch (e: any) {
      enqueueSnackbar("Invalid registration code", { variant: "error" });
    } finally {
      setIsValidating(false);
    }
  }, [invitationCode, enqueueSnackbar, onSuccess]);

  return (
    <Modal
      open={show}
      onClose={closeModal}
      aria-labelledby="modal-modal-title"
      aria-describedby="modal-modal-description"
      data-testid={DATA_TEST_ID.CONTAINER}
    >
      <Box sx={style}>
        <Typography variant="h4" gutterBottom data-testid={DATA_TEST_ID.MODAL_TITLE}>
          Registration code
        </Typography>
        <Typography variant="body2" gutterBottom data-testid={DATA_TEST_ID.MODAL_SUBTITLE}>
          Enter your registration code
        </Typography>
        <TextField
          fullWidth
          label="Registration code"
          variant="outlined"
          placeholder={"Enter your registration code"}
          margin="normal"
          required
          onChange={(e) => setInvitationCode(e.target.value)}
          inputProps={{ "data-testid": DATA_TEST_ID.INVITATION_CODE_INPUT }}
        />
        <PrimaryButton
          fullWidth
          disableWhenOffline
          onClick={validateRegistrationCode}
          disabled={!invitationCode.length || isValidating}
        >
          {isValidating ? "Validating..." : "Validate"}
        </PrimaryButton>
      </Box>
    </Modal>
  );
};

export default RegistrationCodeFormModal;
