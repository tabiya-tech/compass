import React from "react";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { Dialog, DialogActions, DialogContent, DialogTitle, useMediaQuery, useTheme } from "@mui/material";
import { Theme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";

export interface ApproveModalProps {
  title: string;
  content: React.ReactElement;
  isOpen: boolean;
  onCancel: () => void;
  onApprove: () => void;
  cancelButtonText: string;
  approveButtonText: string;
}

const uniqueId = "edc0ac15-67a7-4c1f-9934-94fa65757046";

export const DATA_TEST_ID = {
  APPROVE_MODAL: `approve-modal-${uniqueId}`,
  APPROVE_MODAL_TITLE: `approve-modal-title-${uniqueId}`,
  APPROVE_MODAL_CONTENT: `approve-modal-content-${uniqueId}`,
  APPROVE_MODAL_CANCEL: `approve-modal-cancel-${uniqueId}`,
  APPROVE_MODAL_CONFIRM: `approve-modal-confirm-${uniqueId}`,
};

const ApproveModal: React.FC<ApproveModalProps> = (props) => {
  const theme = useTheme();
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));

  return (
    <Dialog
      open={props.isOpen}
      onClose={props.onCancel}
      aria-labelledby="approve-modal"
      data-testid={DATA_TEST_ID.APPROVE_MODAL}
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
      <DialogTitle id="approve-modal-title" data-testid={DATA_TEST_ID.APPROVE_MODAL_TITLE} sx={{ padding: 0 }}>
        <Typography variant="h6" component="span">
          {props.title}
        </Typography>
      </DialogTitle>
      <DialogContent data-testid={DATA_TEST_ID.APPROVE_MODAL_CONTENT} sx={{ padding: 0 }}>
        {props.content}
      </DialogContent>
      <DialogActions sx={{ padding: 0 }}>
        <PrimaryButton
          variant="text"
          onClick={props.onCancel}
          sx={{ color: theme.palette.text.secondary }}
          data-testid={DATA_TEST_ID.APPROVE_MODAL_CANCEL}
        >
          {props.cancelButtonText}
        </PrimaryButton>
        <PrimaryButton onClick={props.onApprove} data-testid={DATA_TEST_ID.APPROVE_MODAL_CONFIRM}>
          {props.approveButtonText}
        </PrimaryButton>
      </DialogActions>
    </Dialog>
  );
};

export default ApproveModal;
