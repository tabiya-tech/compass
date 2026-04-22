import { Box, IconButton, Typography } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getLogoUrl } from "src/envService";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { copyToClipboard } from "src/error/supportReference/supportReference";

const uniqueId = "37d307ae-4f1e-4d8d-bafe-fd642f8af4ab";

export const DATA_TEST_ID = {
  ERROR_CONTAINER: `error-${uniqueId}}`,
  ERROR_ILLUSTRATION: `error-illustration-${uniqueId}}`,
  ERROR_MESSAGE: `error-message-${uniqueId}`,
  ERROR_SUPPORT_HEADING: `error-support-heading-${uniqueId}`,
  ERROR_SUPPORT_PAYLOAD: `error-support-payload-${uniqueId}`,
  ERROR_SUPPORT_COPY_BUTTON: `error-support-copy-${uniqueId}`,
};

interface ErrorPageProps {
  errorMessage: string;
  showRefreshButton?: boolean;
  supportPayload?: string;
}

const COPIED_RESET_MS = 2000;

const ErrorPage: React.FC<ErrorPageProps> = ({ errorMessage, showRefreshButton = false, supportPayload }) => {
  const { t } = useTranslation();
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const resetTimerRef = useRef<number | null>(null);

  const logoUrlFromEnv = getLogoUrl();
  const logoSrc = logoUrlFromEnv || `${process.env.PUBLIC_URL}/logo.svg`;

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    if (!supportPayload) return;
    const ok = await copyToClipboard(supportPayload);
    setCopyStatus(ok ? "copied" : "failed");
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = window.setTimeout(() => setCopyStatus("idle"), COPIED_RESET_MS);
  };

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
      }}
      data-testid={DATA_TEST_ID.ERROR_CONTAINER}
    >
      <img
        src={logoSrc}
        alt={t("error.errorPage.illustrationAlt")}
        width="250px"
        data-testid={DATA_TEST_ID.ERROR_ILLUSTRATION}
        style={{ marginBottom: "2rem" }}
      />
      <Typography variant="h3" data-testid={DATA_TEST_ID.ERROR_MESSAGE}>
        {errorMessage}
      </Typography>
      {showRefreshButton && (
        <PrimaryButton onClick={() => globalThis.location.reload()} sx={{ marginTop: "1.5rem" }}>
          {t("error.errorPage.refreshButton")}
        </PrimaryButton>
      )}
      {supportPayload && (
        <Box
          sx={{
            marginTop: "2rem",
            maxWidth: "640px",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            gap: 1,
          }}
        >
          <Typography variant="body2" data-testid={DATA_TEST_ID.ERROR_SUPPORT_HEADING}>
            {t("error.supportReference.heading")}
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 1,
              backgroundColor: "background.paper",
              border: (theme) => `1px solid ${theme.palette.divider}`,
              borderRadius: 1,
              padding: 1.5,
              textAlign: "left",
            }}
          >
            <Typography
              component="pre"
              variant="body2"
              data-testid={DATA_TEST_ID.ERROR_SUPPORT_PAYLOAD}
              sx={{
                flex: 1,
                fontFamily: "monospace",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                margin: 0,
              }}
            >
              {supportPayload}
            </Typography>
            <IconButton
              title={t(
                copyStatus === "copied"
                  ? "error.supportReference.copied"
                  : copyStatus === "failed"
                    ? "error.supportReference.copyFailed"
                    : "error.supportReference.copyButton"
              )}
              data-testid={DATA_TEST_ID.ERROR_SUPPORT_COPY_BUTTON}
              onClick={handleCopy}
              size="small"
            >
              {copyStatus === "copied" ? (
                <CheckIcon fontSize="small" />
              ) : copyStatus === "failed" ? (
                <ErrorOutlineIcon fontSize="small" />
              ) : (
                <ContentCopyIcon fontSize="small" />
              )}
            </IconButton>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ErrorPage;
