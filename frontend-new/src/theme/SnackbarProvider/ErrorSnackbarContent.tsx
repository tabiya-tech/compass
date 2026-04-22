import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SnackbarContent, SnackbarKey, SnackbarMessage, useSnackbar } from "notistack";
import { Box, IconButton, Typography, useTheme } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import CheckIcon from "@mui/icons-material/Check";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { copyToClipboard } from "src/error/supportReference/supportReference";

const uniqueId = "9e3c4a2f-8b1d-4a0e-91c4-5d2f8a1b7e3c";
export const DATA_TEST_ID = {
  CONTAINER: `error-snackbar-container-${uniqueId}`,
  BADGE: `error-snackbar-badge-${uniqueId}`,
  MESSAGE: `error-snackbar-message-${uniqueId}`,
  EXPAND_BUTTON: `error-snackbar-expand-button-${uniqueId}`,
  COPY_BUTTON: `error-snackbar-copy-button-${uniqueId}`,
  CLOSE_BUTTON: `error-snackbar-close-button-${uniqueId}`,
};

const COPIED_RESET_MS = 2000;

type Props = {
  id: SnackbarKey;
  message: SnackbarMessage;
  payload: string;
};

export const ErrorSnackbarContent = forwardRef<HTMLDivElement, Props>(({ id, message, payload }, ref) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { closeSnackbar } = useSnackbar();
  const messageRef = useRef<HTMLSpanElement | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  const measureOverflow = useCallback(() => {
    const el = messageRef.current;
    if (!el || isExpanded) return;
    setHasOverflow(el.scrollWidth > el.clientWidth + 1);
  }, [isExpanded]);

  useLayoutEffect(() => {
    measureOverflow();
  }, [measureOverflow, message]);

  useEffect(() => {
    window.addEventListener("resize", measureOverflow);
    return () => window.removeEventListener("resize", measureOverflow);
  }, [measureOverflow]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    const ok = await copyToClipboard(payload);
    setCopyStatus(ok ? "copied" : "failed");
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = window.setTimeout(() => setCopyStatus("idle"), COPIED_RESET_MS);
  };

  const iconButtonSx = {
    width: 30,
    height: 30,
    borderRadius: 1,
    padding: 0,
    color: theme.palette.error.dark,
    "&:hover": {
      backgroundColor: "rgba(0, 0, 0, 0.06)",
    },
  } as const;

  const iconSx = { fontSize: 18, strokeWidth: 1.5 };

  return (
    <SnackbarContent ref={ref} role="alert">
      <Box
        data-testid={DATA_TEST_ID.CONTAINER}
        sx={{
          display: "flex",
          alignItems: isExpanded ? "flex-start" : "center",
          gap: "12px",
          padding: "10px 10px 10px 14px",
          borderRadius: 1,
          backgroundColor: theme.palette.error.light,
          color: theme.palette.error.dark,
          fontFamily: theme.typography.body1.fontFamily,
          fontSize: theme.typography.body1.fontSize,
          minWidth: "340px",
          maxWidth: "600px",
          boxShadow: theme.shadows[2],
        }}
      >
        <Box
          data-testid={DATA_TEST_ID.BADGE}
          aria-hidden
          sx={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            backgroundColor: theme.palette.error.dark,
            color: theme.palette.error.light,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: isExpanded ? "2px" : 0,
          }}
        >
          <CloseIcon sx={{ fontSize: 16, strokeWidth: 1.6 }} />
        </Box>

        <Typography
          ref={messageRef}
          component="span"
          data-testid={DATA_TEST_ID.MESSAGE}
          sx={{
            flex: 1,
            minWidth: 0,
            lineHeight: 1.25,
            padding: "1px 0",
            whiteSpace: isExpanded ? "normal" : "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontFamily: "inherit",
            fontSize: "inherit",
            color: "inherit",
          }}
        >
          {message}
        </Typography>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: "2px",
            marginLeft: "4px",
            flexShrink: 0,
          }}
        >
          {hasOverflow && (
            <IconButton
              data-testid={DATA_TEST_ID.EXPAND_BUTTON}
              title={t(isExpanded ? "error.supportReference.collapse" : "error.supportReference.expand")}
              onClick={() => setIsExpanded((prev) => !prev)}
              sx={iconButtonSx}
            >
              {isExpanded ? <KeyboardArrowUpIcon sx={iconSx} /> : <KeyboardArrowDownIcon sx={iconSx} />}
            </IconButton>
          )}
          <IconButton
            data-testid={DATA_TEST_ID.COPY_BUTTON}
            title={t(
              copyStatus === "copied"
                ? "error.supportReference.copied"
                : copyStatus === "failed"
                  ? "error.supportReference.copyFailed"
                  : "error.supportReference.copyButton"
            )}
            onClick={handleCopy}
            sx={iconButtonSx}
          >
            {copyStatus === "copied" ? (
              <CheckIcon sx={iconSx} />
            ) : copyStatus === "failed" ? (
              <ErrorOutlineIcon sx={iconSx} />
            ) : (
              <ContentCopyOutlinedIcon sx={iconSx} />
            )}
          </IconButton>
          <IconButton
            data-testid={DATA_TEST_ID.CLOSE_BUTTON}
            title={t("error.supportReference.close")}
            onClick={() => closeSnackbar(id)}
            sx={iconButtonSx}
          >
            <CloseIcon sx={iconSx} />
          </IconButton>
        </Box>
      </Box>
    </SnackbarContent>
  );
});

ErrorSnackbarContent.displayName = "ErrorSnackbarContent";
