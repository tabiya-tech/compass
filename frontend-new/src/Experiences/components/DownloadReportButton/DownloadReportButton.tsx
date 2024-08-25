import React from "react";
import { Box, IconButton, Typography, useTheme } from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import InfoIcon from "@mui/icons-material/Info";
import HelpTip from "src/theme/HelpTip/HelpTip";
import SkillReport from "src/Report/Report";
import { Experience } from "src/Experiences/ExperienceService/Experiences.types";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";

const uniqueId = "f5553dac-adb7-440f-9549-c3567b22dc76";
export const DATA_TEST_ID = {
  DOWNLOAD_REPORT_BUTTON_CONTAINER: `download-report-button-container-${uniqueId}`,
  DOWNLOAD_REPORT_BUTTON: `download-report-button-${uniqueId}`,
  DOWNLOAD_REPORT_ICON: `download-report-icon-${uniqueId}`,
  DOWNLOAD_REPORT_HELP_TIP: `download-report-help-tip-${uniqueId}`,
};

export interface DownloadReportButtonProps {
  disabled?: boolean;
  name: string;
  email: string;
  phone: string;
  address: string;
  experiences: Experience[];
  conversationCompletedAt: string | null;
}

const DownloadReportButton: React.FC<DownloadReportButtonProps> = (props) => {
  const theme = useTheme();

  const downloadPdf = async () => {
    const fileName = "skillsReport.pdf";
    const blob = await pdf(
      <SkillReport
        name={props.name}
        email={props.email}
        phone={props.phone}
        address={props.address}
        experiences={props.experiences}
        conversationCompletedAt={props.conversationCompletedAt}
      />
    ).toBlob();
    saveAs(blob, fileName);
  };

  return (
    <Box data-testid={DATA_TEST_ID.DOWNLOAD_REPORT_BUTTON_CONTAINER}>
      <IconButton
        sx={{
          margin: 0,
          color: theme.palette.tabiyaBlue.main,
          borderRadius: (theme) => theme.tabiyaRounding.sm,
        }}
        title="Download Report"
        disabled={props.disabled}
        onClick={downloadPdf}
        data-testid={DATA_TEST_ID.DOWNLOAD_REPORT_BUTTON}
      >
        <FileDownloadIcon sx={{ lineHeight: 0 }} data-testid={DATA_TEST_ID.DOWNLOAD_REPORT_ICON} />
        <Typography
          variant="caption"
          sx={{
            color: theme.palette.tabiyaBlue.main,
            opacity: props.disabled ? 0.5 : 1,
          }}
        >
          Download
        </Typography>
      </IconButton>
      {props.disabled && (
        <HelpTip icon={<InfoIcon />} data-testid={DATA_TEST_ID.DOWNLOAD_REPORT_HELP_TIP}>
          You cannot download the report until the conversation is completed.
        </HelpTip>
      )}
    </Box>
  );
};
export default DownloadReportButton;
