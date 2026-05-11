import React, { useCallback, useMemo, useState } from "react";
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { alpha, useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { BugReport, ChatBubbleOutline, EmojiObjectsOutlined } from "@mui/icons-material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import SecondaryButton from "src/theme/SecondaryButton/SecondaryButton";

export type FeedbackType = "bug" | "feedback" | "idea";
export type FeedbackPriority = "low" | "medium" | "high";

export interface FeedbackModalSubmitPayload {
  type: FeedbackType;
  priority: FeedbackPriority;
  message: string;
}

export interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: FeedbackModalSubmitPayload) => void | Promise<void>;
}

const uniqueId = "9b3a4f25-7c2d-4d9e-a1f1-2a6e8b4c3f10";

export const DATA_TEST_ID = {
  FEEDBACK_MODAL: `feedback-modal-${uniqueId}`,
  FEEDBACK_MODAL_TITLE: `feedback-modal-title-${uniqueId}`,
  FEEDBACK_MODAL_SUBTITLE: `feedback-modal-subtitle-${uniqueId}`,
  FEEDBACK_MODAL_TYPE_GROUP: `feedback-modal-type-group-${uniqueId}`,
  FEEDBACK_MODAL_PRIORITY_GROUP: `feedback-modal-priority-group-${uniqueId}`,
  FEEDBACK_MODAL_TYPE_OPTION: (type: FeedbackType) => `feedback-modal-type-${type}-${uniqueId}`,
  FEEDBACK_MODAL_PRIORITY_OPTION: (priority: FeedbackPriority) => `feedback-modal-priority-${priority}-${uniqueId}`,
  FEEDBACK_MODAL_MESSAGE: `feedback-modal-message-${uniqueId}`,
  FEEDBACK_MODAL_CANCEL: `feedback-modal-cancel-${uniqueId}`,
  FEEDBACK_MODAL_SEND: `feedback-modal-send-${uniqueId}`,
};

const FEEDBACK_TYPES: ReadonlyArray<{ value: FeedbackType; icon: React.ReactNode }> = [
  { value: "bug", icon: <BugReport sx={{ fontSize: 16 }} /> },
  { value: "feedback", icon: <ChatBubbleOutline sx={{ fontSize: 16 }} /> },
  { value: "idea", icon: <EmojiObjectsOutlined sx={{ fontSize: 16 }} /> },
];

const FEEDBACK_PRIORITIES: ReadonlyArray<FeedbackPriority> = ["low", "medium", "high"];

interface PillButtonProps {
  selected: boolean;
  onClick: () => void;
  startIcon?: React.ReactNode;
  children: React.ReactNode;
  "data-testid"?: string;
}

const PillButton: React.FC<PillButtonProps> = ({ selected, onClick, startIcon, children, ...rest }) => {
  const theme = useTheme();
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      data-testid={rest["data-testid"]}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: theme.spacing(0.75),
        paddingY: theme.spacing(0.75),
        paddingX: theme.spacing(1.5),
        borderRadius: 999,
        border: `1px solid ${selected ? theme.palette.primary.main : theme.palette.divider}`,
        backgroundColor: selected ? alpha(theme.palette.primary.main, 0.12) : theme.palette.background.paper,
        color: selected ? theme.palette.primary.dark : theme.palette.text.primary,
        fontSize: theme.typography.body2.fontSize,
        fontWeight: selected ? 600 : 500,
        cursor: "pointer",
        transition: "background-color 120ms ease, border-color 120ms ease, color 120ms ease",
        "&:hover": {
          borderColor: theme.palette.primary.main,
          backgroundColor: selected
            ? alpha(theme.palette.primary.main, 0.18)
            : alpha(theme.palette.primary.main, 0.04),
        },
        "&:focus-visible": {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: 2,
        },
      }}
    >
      {startIcon}
      <span>{children}</span>
    </Box>
  );
};

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));

  const [type, setType] = useState<FeedbackType>("bug");
  const [priority, setPriority] = useState<FeedbackPriority>("medium");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetState = useCallback(() => {
    setType("bug");
    setPriority("medium");
    setMessage("");
    setIsSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    resetState();
    onClose();
  }, [isSubmitting, onClose, resetState]);

  const handleSend = useCallback(async () => {
    if (isSubmitting || message.trim().length === 0) return;
    setIsSubmitting(true);
    try {
      await onSubmit({ type, priority, message: message.trim() });
      resetState();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, message, onClose, onSubmit, priority, resetState, type]);

  const typeLabels = useMemo(
    () => ({
      bug: t("feedback.feedbackModal.type.bug"),
      feedback: t("feedback.feedbackModal.type.feedback"),
      idea: t("feedback.feedbackModal.type.idea"),
    }),
    [t]
  );

  const priorityLabels = useMemo(
    () => ({
      low: t("feedback.feedbackModal.priority.low"),
      medium: t("feedback.feedbackModal.priority.medium"),
      high: t("feedback.feedbackModal.priority.high"),
    }),
    [t]
  );

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      aria-labelledby={DATA_TEST_ID.FEEDBACK_MODAL_TITLE}
      data-testid={DATA_TEST_ID.FEEDBACK_MODAL}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          padding: isSmallMobile
            ? theme.fixedSpacing(theme.tabiyaSpacing.md)
            : theme.fixedSpacing(theme.tabiyaSpacing.lg),
          gap: theme.spacing(theme.tabiyaSpacing.md),
          display: "flex",
        },
      }}
    >
      <DialogTitle
        id={DATA_TEST_ID.FEEDBACK_MODAL_TITLE}
        data-testid={DATA_TEST_ID.FEEDBACK_MODAL_TITLE}
        sx={{ padding: 0, display: "flex", flexDirection: "column", gap: theme.spacing(0.5) }}
      >
        <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
          {t("feedback.feedbackModal.title")}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          data-testid={DATA_TEST_ID.FEEDBACK_MODAL_SUBTITLE}
        >
          {t("feedback.feedbackModal.subtitle")}
        </Typography>
      </DialogTitle>

      <DialogContent
        sx={{
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: theme.spacing(theme.tabiyaSpacing.md),
          overflow: "visible",
        }}
      >
        <Box
          data-testid={DATA_TEST_ID.FEEDBACK_MODAL_TYPE_GROUP}
          role="radiogroup"
          sx={{ display: "flex", flexWrap: "wrap", gap: theme.spacing(1) }}
        >
          {FEEDBACK_TYPES.map(({ value, icon }) => (
            <PillButton
              key={value}
              selected={type === value}
              onClick={() => setType(value)}
              startIcon={icon}
              data-testid={DATA_TEST_ID.FEEDBACK_MODAL_TYPE_OPTION(value)}
            >
              {typeLabels[value]}
            </PillButton>
          ))}
        </Box>

        <Box
          data-testid={DATA_TEST_ID.FEEDBACK_MODAL_PRIORITY_GROUP}
          role="radiogroup"
          sx={{ display: "flex", flexWrap: "wrap", gap: theme.spacing(1) }}
        >
          {FEEDBACK_PRIORITIES.map((value) => (
            <PillButton
              key={value}
              selected={priority === value}
              onClick={() => setPriority(value)}
              data-testid={DATA_TEST_ID.FEEDBACK_MODAL_PRIORITY_OPTION(value)}
            >
              {priorityLabels[value]}
            </PillButton>
          ))}
        </Box>

        <TextField
          data-testid={DATA_TEST_ID.FEEDBACK_MODAL_MESSAGE}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={t("feedback.feedbackModal.messagePlaceholder")}
          multiline
          minRows={4}
          fullWidth
          disabled={isSubmitting}
          inputProps={{ "aria-label": t("feedback.feedbackModal.messagePlaceholder") }}
        />
      </DialogContent>

      <DialogActions sx={{ padding: 0, gap: theme.spacing(1) }}>
        <SecondaryButton
          onClick={handleClose}
          disabled={isSubmitting}
          data-testid={DATA_TEST_ID.FEEDBACK_MODAL_CANCEL}
        >
          {t("feedback.feedbackModal.cancel")}
        </SecondaryButton>
        <PrimaryButton
          onClick={handleSend}
          disabled={isSubmitting || message.trim().length === 0}
          data-testid={DATA_TEST_ID.FEEDBACK_MODAL_SEND}
        >
          {t("feedback.feedbackModal.send")}
        </PrimaryButton>
      </DialogActions>
    </Dialog>
  );
};

export default FeedbackModal;
