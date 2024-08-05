import React from "react";
import { Box, IconButton, Typography, useTheme } from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import InfoIcon from "@mui/icons-material/Info";
import HelpTip from "src/theme/HelpTip/HelpTip";

const uniqueId = "f5553dac-adb7-440f-9549-c3567b22dc76";
export const DATA_TEST_ID = {
  DOWNLOAD_REPORT_BUTTON_CONTAINER: `download-report-button-container-${uniqueId}`,
  DOWNLOAD_REPORT_BUTTON: `download-report-button-${uniqueId}`,
  DOWNLOAD_REPORT_ICON: `download-report-icon-${uniqueId}`,
  DOWNLOAD_REPORT_HELP_TIP: `download-report-help-tip-${uniqueId}`,
};

export interface DownloadReportButtonProps {
  disabled?: boolean;
}

const DownloadReportButton: React.FC<DownloadReportButtonProps> = ({ disabled }) => {
  const theme = useTheme();
  return (
    <Box data-testid={DATA_TEST_ID.DOWNLOAD_REPORT_BUTTON_CONTAINER}>
      <IconButton
        sx={{
          margin: 0,
          color: theme.palette.tabiyaBlue.main,
          borderRadius: (theme) => theme.tabiyaRounding.sm,
        }}
        title="Download Report"
        disabled={disabled}
        data-testid={DATA_TEST_ID.DOWNLOAD_REPORT_BUTTON}
      >
        <FileDownloadIcon sx={{ lineHeight: 0 }} data-testid={DATA_TEST_ID.DOWNLOAD_REPORT_ICON} />
        <Typography
          variant="caption"
          sx={{
            color: theme.palette.tabiyaBlue.main,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          Download
        </Typography>
      </IconButton>
      {disabled && (
        <HelpTip icon={<InfoIcon />} data-testid={DATA_TEST_ID.DOWNLOAD_REPORT_HELP_TIP}>
          You cannot download the report until the conversation is completed.
        </HelpTip>
      )}
    </Box>
  );
};
export default DownloadReportButton;
