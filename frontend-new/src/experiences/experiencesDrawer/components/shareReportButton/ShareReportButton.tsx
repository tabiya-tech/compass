import React, { useEffect, useState } from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import ShareIcon from "@mui/icons-material/Share";
import { useTranslation } from "react-i18next";
import { Experience } from "src/experiences/experienceService/experiences.types";
import {
  PDFReportDownloadProvider,
  PDF_REPORT_FILENAME,
  PDF_MIME_TYPE,
} from "src/experiences/report/reportPdf/provider";
import { SkillsReportOutputConfig } from "src/experiences/report/config/types";
import { getSkillsReportOutputConfig } from "src/experiences/report/config/getConfig";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import SecondaryButton from "src/theme/SecondaryButton/SecondaryButton";

const uniqueId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
export const DATA_TEST_ID = {
  SHARE_REPORT_BUTTON_CONTAINER: `share-report-button-container-${uniqueId}`,
  SHARE_REPORT_BUTTON: `share-report-button-${uniqueId}`,
  SHARE_REPORT_ICON: `share-report-icon-${uniqueId}`,
  SHARE_REPORT_LOADING: `share-report-loading-${uniqueId}`,
  SHARE_REPORT_LOADING_TEXT: `share-report-loading-text-${uniqueId}`,
};

export interface ShareReportButtonProps {
  name: string;
  email: string;
  location: string;
  school: string;
  program: string;
  experiences: Experience[];
  conversationConductedAt: string | null;
  disabled?: boolean;
  outputConfig?: SkillsReportOutputConfig;
}

/**
 * ShareReportButton component for sharing Experience Reports as PDF using the Web Share API.
 * - Only renders when navigator.share is available (progressive enhancement)
 * - Logs console warning when Share API is not available
 * - Shows "Preparing your pdf" loading indicator during PDF generation
 * - Handles share errors with user-friendly messages
 */
const ShareReportButton: React.FC<ShareReportButtonProps> = ({
  name,
  email,
  location,
  school,
  program,
  experiences,
  conversationConductedAt,
  disabled,
  outputConfig,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [isSharing, setIsSharing] = useState(false);
  const [isShareSupported, setIsShareSupported] = useState(false);

  // Check for Web Share API support on mount
  useEffect(() => {
    const checkShareSupport = () => {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        setIsShareSupported(true);
      } else {
        console.warn("Web Share API is not available in this browser. Share button will not be rendered.");
        setIsShareSupported(false);
      }
    };

    checkShareSupport();
  }, []);

  const handleShare = async () => {
    if (!isShareSupported) {
      return;
    }

    setIsSharing(true);

    try {
      const config = outputConfig ?? getSkillsReportOutputConfig();
      const pdfProvider = new PDFReportDownloadProvider(config);

      // Generate PDF blob
      const blob = await pdfProvider.generateBlob({
        name,
        email,
        location,
        school,
        program,
        experiences,
        conversationConductedAt: conversationConductedAt ?? new Date().toISOString(),
      });

      // Create a File object from the blob for sharing
      const file = new File([blob], PDF_REPORT_FILENAME, { type: PDF_MIME_TYPE });

      // Share using the Web Share API
      await navigator.share({
        files: [file],
        title: t("experiences.experiencesDrawer.components.shareReportButton.shareTitle"),
        text: t("experiences.experiencesDrawer.components.shareReportButton.shareText"),
      });
    } catch (error) {
      // Show warning message for user cancellation (AbortError)
      if (error instanceof Error && error.name === "AbortError") {
        enqueueSnackbar(t("experiences.experiencesDrawer.components.shareReportButton.shareCanceled"), {
          variant: "warning",
        });
        return;
      }

      console.error("Failed to share report:", error);
      enqueueSnackbar(t("experiences.experiencesDrawer.components.shareReportButton.shareFailed"), {
        variant: "error",
      });
    } finally {
      setIsSharing(false);
    }
  };

  // Don't render if Share API is not supported
  if (!isShareSupported) {
    return null;
  }

  return (
    <Box data-testid={DATA_TEST_ID.SHARE_REPORT_BUTTON_CONTAINER} sx={{ width: { xs: "100%", sm: "auto" } }}>
      <SecondaryButton
        title={t("experiences.experiencesDrawer.components.shareReportButton.shareReport")}
        disabled={disabled || isSharing}
        onClick={handleShare}
        fullWidth
        sx={{ width: { xs: "100%", sm: "auto" }, alignSelf: { xs: "stretch", sm: "flex-start" } }}
        startIcon={
          isSharing ? (
            <CircularProgress
              size={theme.spacing(2.5)}
              sx={{ color: theme.palette.text.secondary }}
              data-testid={DATA_TEST_ID.SHARE_REPORT_LOADING}
            />
          ) : (
            <ShareIcon data-testid={DATA_TEST_ID.SHARE_REPORT_ICON} />
          )
        }
        data-testid={DATA_TEST_ID.SHARE_REPORT_BUTTON}
      >
        {isSharing
          ? t("experiences.experiencesDrawer.components.shareReportButton.preparingPdf")
          : t("experiences.experiencesDrawer.components.shareReportButton.share")}
      </SecondaryButton>
    </Box>
  );
};

export default ShareReportButton;
