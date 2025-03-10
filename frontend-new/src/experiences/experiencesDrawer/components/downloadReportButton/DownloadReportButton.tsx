import React from "react";
import { Box, CircularProgress, IconButton, Typography, useTheme } from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import InfoIcon from "@mui/icons-material/Info";
import HelpTip from "src/theme/HelpTip/HelpTip";

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

  return (
    <Box data-testid={DATA_TEST_ID.DOWNLOAD_REPORT_BUTTON_CONTAINER}>
      <IconButton
        sx={{
          margin: 0,
          color: theme.palette.tabiyaBlue.main,
          borderRadius: (theme) => theme.tabiyaRounding.sm,
        }}
        title="Download CV"
        disabled={disabled || isLoading}
        onClick={notifyOnDownloadPdf}
        data-testid={DATA_TEST_ID.DOWNLOAD_REPORT_BUTTON}
      >
        {isLoading ? (
          <CircularProgress
            sx={{ color: theme.palette.tabiyaBlue.main, marginRight: theme.fixedSpacing(theme.tabiyaSpacing.xs) }}
            size={theme.spacing(3)}
            data-testid={DATA_TEST_ID.DOWNLOAD_REPORT_PROGRESS_ICON}
          />
        ) : (
          <FileDownloadIcon sx={{ lineHeight: 0 }} data-testid={DATA_TEST_ID.DOWNLOAD_REPORT_ICON} />
        )}
        <Typography
          variant="caption"
          sx={{
            color: theme.palette.tabiyaBlue.main,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {isLoading ? "Downloading" : "Download CV"}
        </Typography>
      </IconButton>
      {disabled && (
        <HelpTip icon={<InfoIcon />} data-testid={DATA_TEST_ID.DOWNLOAD_REPORT_HELP_TIP}>
          You cannot download the report until you finish exploring at least one experience.
        </HelpTip>
      )}
    </Box>
  );
};
export default DownloadReportButton;
