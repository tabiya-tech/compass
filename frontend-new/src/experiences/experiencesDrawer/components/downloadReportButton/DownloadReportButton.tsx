import React from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import InfoIcon from "@mui/icons-material/Info";
import HelpTip from "src/theme/HelpTip/HelpTip";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { useTranslation } from "react-i18next";

const uniqueId = "f5553dac-adb7-440f-9549-c3567b22dc76";
export const DATA_TEST_ID = {
  DOWNLOAD_REPORT_BUTTON_CONTAINER: `download-report-button-container-${uniqueId}`,
  DOWNLOAD_REPORT_BUTTON: `download-report-button-${uniqueId}`,
  DOWNLOAD_REPORT_ICON: `download-report-icon-${uniqueId}`,
  DOWNLOAD_REPORT_HELP_TIP: `download-report-help-tip-${uniqueId}`,
  DOWNLOAD_REPORT_PROGRESS_ICON: `download-report-progress-icon-${uniqueId}`,
};

export interface DownloadReportButtonProps {
  disabled?: boolean;
  isLoading?: boolean;
  notifyOnDownloadPdf: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const DownloadReportButton: React.FC<DownloadReportButtonProps> = ({ disabled, isLoading, notifyOnDownloadPdf }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Box data-testid={DATA_TEST_ID.DOWNLOAD_REPORT_BUTTON_CONTAINER}>
      <PrimaryButton
        title={t("experiences.experiencesDrawer.components.downloadReportButton.downloadCv")}
        disabled={disabled || isLoading}
        disableWhenOffline
        startIcon={
          isLoading ? (
            <CircularProgress
              sx={{ color: theme.palette.tabiyaBlue.main, marginRight: theme.fixedSpacing(theme.tabiyaSpacing.xs) }}
              size={theme.spacing(3)}
              data-testid={DATA_TEST_ID.DOWNLOAD_REPORT_PROGRESS_ICON}
            />
          ) : (
            <FileDownloadIcon sx={{ lineHeight: 0 }} data-testid={DATA_TEST_ID.DOWNLOAD_REPORT_ICON} />
          )
        }
        onClick={notifyOnDownloadPdf}
        data-testid={DATA_TEST_ID.DOWNLOAD_REPORT_BUTTON}
      >
        {isLoading
          ? t("experiences.experiencesDrawer.components.downloadReportButton.downloading")
          : t("experiences.experiencesDrawer.components.downloadReportButton.downloadCv")}
      </PrimaryButton>
      {disabled && (
        <HelpTip icon={<InfoIcon />} data-testid={DATA_TEST_ID.DOWNLOAD_REPORT_HELP_TIP}>
          {t("experiences.experiencesDrawer.components.downloadReportButton.helpTipBlockedMessage")}
        </HelpTip>
      )}
    </Box>
  );
};
export default DownloadReportButton;
