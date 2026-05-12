import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Box,
  CircularProgress,
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
import { AddPhotoAlternate, BugReport, ChatBubbleOutline, Close, EmojiObjectsOutlined } from "@mui/icons-material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import SecondaryButton from "src/theme/SecondaryButton/SecondaryButton";

export type FeedbackType = "bug" | "feedback" | "idea";
export type FeedbackPriority = "low" | "medium" | "high";

export interface FeedbackScreenshot {
  data: Uint8Array;
  filename: string;
  contentType: string;
}

export interface FeedbackModalSubmitPayload {
  type: FeedbackType;
  priority: FeedbackPriority;
  message: string;
  screenshot?: FeedbackScreenshot;
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
  FEEDBACK_MODAL_SCREENSHOT_BUTTON: `feedback-modal-screenshot-button-${uniqueId}`,
  FEEDBACK_MODAL_SCREENSHOT_PREVIEW: `feedback-modal-screenshot-preview-${uniqueId}`,
  FEEDBACK_MODAL_SCREENSHOT_REMOVE: `feedback-modal-screenshot-remove-${uniqueId}`,
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
          backgroundColor: selected ? alpha(theme.palette.primary.main, 0.18) : alpha(theme.palette.primary.main, 0.04),
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

async function captureScreenshot(): Promise<FeedbackScreenshot | null> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { width: window.innerWidth * devicePixelRatio, height: window.innerHeight * devicePixelRatio },
    audio: false,
    // @ts-expect-error experimental flags used by Sentry's own implementation
    preferCurrentTab: true,
    selfBrowserSurface: "include",
    surfaceSwitching: "exclude",
    monitorTypeSurfaces: "exclude",
  });

  const video = document.createElement("video");
  await new Promise<void>((resolve, reject) => {
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      stream.getTracks().forEach((track) => track.stop());
      resolve();
    };
    video.onerror = reject;
    video.play().catch(reject);
  });

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return null;

  return {
    data: new Uint8Array(await blob.arrayBuffer()),
    filename: "screenshot.png",
    contentType: "image/png",
  };
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));

  const [type, setType] = useState<FeedbackType>("bug");
  const [priority, setPriority] = useState<FeedbackPriority>("medium");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<FeedbackScreenshot | null>(null);
  const [screenshotPreviewUrl, setScreenshotPreviewUrl] = useState<string | null>(null);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const previewUrlRef = useRef<string | null>(null);

  const resetState = useCallback(() => {
    setType("bug");
    setPriority("medium");
    setMessage("");
    setScreenshot(null);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setScreenshotPreviewUrl(null);
    setIsCapturingScreenshot(false);
    setIsSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    resetState();
    onClose();
  }, [isSubmitting, onClose, resetState]);

  const handleAddScreenshot = useCallback(async () => {
    setIsCapturingScreenshot(true);
    try {
      const captured = await captureScreenshot();
      if (captured) {
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        const url = URL.createObjectURL(new Blob([captured.data], { type: captured.contentType }));
        previewUrlRef.current = url;
        setScreenshot(captured);
        setScreenshotPreviewUrl(url);
      }
    } catch (error) {
      // User cancelled or browser denied — silently ignore
      console.debug("Screenshot capture cancelled or failed:", error);
    } finally {
      setIsCapturingScreenshot(false);
    }
  }, []);

  const handleRemoveScreenshot = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setScreenshot(null);
    setScreenshotPreviewUrl(null);
  }, []);

  const handleSend = useCallback(async () => {
    if (isSubmitting || message.trim().length === 0) return;
    setIsSubmitting(true);
    try {
      await onSubmit({ type, priority, message: message.trim(), screenshot: screenshot ?? undefined });
      resetState();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, message, onClose, onSubmit, priority, resetState, screenshot, type]);

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
        <Typography variant="body2" color="text.secondary" data-testid={DATA_TEST_ID.FEEDBACK_MODAL_SUBTITLE}>
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

        <Box sx={{ display: "flex", flexDirection: "column", gap: theme.spacing(1) }}>
          {screenshotPreviewUrl ? (
            <Box sx={{ position: "relative", display: "inline-flex", alignSelf: "flex-start" }}>
              <Box
                component="img"
                src={screenshotPreviewUrl}
                alt={t("feedback.feedbackModal.screenshotAlt")}
                data-testid={DATA_TEST_ID.FEEDBACK_MODAL_SCREENSHOT_PREVIEW}
                sx={{
                  maxWidth: "100%",
                  maxHeight: 160,
                  borderRadius: 1,
                  border: `1px solid ${theme.palette.divider}`,
                  display: "block",
                }}
              />
              <Box
                component="button"
                type="button"
                aria-label={t("feedback.feedbackModal.removeScreenshot")}
                data-testid={DATA_TEST_ID.FEEDBACK_MODAL_SCREENSHOT_REMOVE}
                onClick={handleRemoveScreenshot}
                sx={{
                  position: "absolute",
                  top: -8,
                  right: -8,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  border: "none",
                  backgroundColor: theme.palette.text.secondary,
                  color: theme.palette.background.paper,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0,
                  "&:hover": { backgroundColor: theme.palette.text.primary },
                }}
              >
                <Close sx={{ fontSize: 14 }} />
              </Box>
            </Box>
          ) : (
            <Box
              component="button"
              type="button"
              data-testid={DATA_TEST_ID.FEEDBACK_MODAL_SCREENSHOT_BUTTON}
              disabled={isSubmitting || isCapturingScreenshot}
              onClick={handleAddScreenshot}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                alignSelf: "flex-start",
                gap: theme.spacing(0.75),
                paddingY: theme.spacing(0.75),
                paddingX: theme.spacing(1.5),
                borderRadius: 999,
                border: `1px dashed ${theme.palette.divider}`,
                backgroundColor: "transparent",
                color: theme.palette.text.secondary,
                fontSize: theme.typography.body2.fontSize,
                fontWeight: 500,
                cursor: "pointer",
                transition: "border-color 120ms ease, color 120ms ease",
                "&:hover:not(:disabled)": {
                  borderColor: theme.palette.primary.main,
                  color: theme.palette.primary.main,
                },
                "&:disabled": { opacity: 0.5, cursor: "default" },
              }}
            >
              {isCapturingScreenshot ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <AddPhotoAlternate sx={{ fontSize: 16 }} />
              )}
              <span>{t("feedback.feedbackModal.addScreenshot")}</span>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ padding: 0, gap: theme.spacing(1) }}>
        <SecondaryButton onClick={handleClose} disabled={isSubmitting} data-testid={DATA_TEST_ID.FEEDBACK_MODAL_CANCEL}>
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
