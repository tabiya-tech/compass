import React from "react";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { Dialog, DialogActions, DialogContent, DialogTitle, useMediaQuery, useTheme } from "@mui/material";
import { Theme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import SecondaryButton from "src/theme/CancelButton/SecondaryButton";

export interface ConfirmModalDialogProps {
  title: string;
  content: React.ReactElement;
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  cancelButtonText: string;
  confirmButtonText: string;
}

const uniqueId = "edc0ac15-67a7-4c1f-9934-94fa65757046";

export const DATA_TEST_ID = {
  CONFIRM_MODAL: `confirm-modal-${uniqueId}`,
  CONFIRM_MODAL_TITLE: `confirm-modal-title-${uniqueId}`,
  CONFIRM_MODAL_CONTENT: `confirm-modal-content-${uniqueId}`,
  CONFIRM_MODAL_CANCEL: `confirm-modal-cancel-${uniqueId}`,
  CONFIRM_MODAL_CONFIRM: `confirm-modal-confirm-${uniqueId}`,
};

const ConfirmModalDialog: React.FC<ConfirmModalDialogProps> = (props) => {
  const theme = useTheme();
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));

  return (
    <Dialog
      open={props.isOpen}
      onClose={props.onCancel}
      aria-labelledby="confirm-modal"
      data-testid={DATA_TEST_ID.CONFIRM_MODAL}
      PaperProps={{
        sx: {
          display: "flex",
          gap: isSmallMobile ? theme.tabiyaSpacing.xl : theme.tabiyaSpacing.lg,
          padding: isSmallMobile
            ? theme.fixedSpacing(theme.tabiyaSpacing.md)
            : theme.fixedSpacing(theme.tabiyaSpacing.lg),
        },
      }}
    >
      <DialogTitle id="confirm-modal-title" data-testid={DATA_TEST_ID.CONFIRM_MODAL_TITLE} sx={{ padding: 0 }}>
        <Typography variant="h6" component="span">
          {props.title}
        </Typography>
      </DialogTitle>
      <DialogContent data-testid={DATA_TEST_ID.CONFIRM_MODAL_CONTENT} sx={{ padding: 0 }}>
        {props.content}
      </DialogContent>
      <DialogActions sx={{ padding: 0 }}>
        <SecondaryButton
          onClick={props.onCancel}
          data-testid={DATA_TEST_ID.CONFIRM_MODAL_CANCEL}
        >
          {props.cancelButtonText}
        </SecondaryButton>
        <PrimaryButton onClick={props.onConfirm} data-testid={DATA_TEST_ID.CONFIRM_MODAL_CONFIRM}>
          {props.confirmButtonText}
        </PrimaryButton>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmModalDialog;