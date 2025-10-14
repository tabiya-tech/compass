import React from "react";
import { Box, Divider, Typography, useTheme, AccordionSummary, AccordionDetails } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import InfoIcon from "@mui/icons-material/Info";
import HelpTip from "src/theme/HelpTip/HelpTip";
import { getDurationFromNow } from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/getDurationFromNow/getDurationFromNow";
import { StyledAccordion } from "src/theme/CustomAccordion/CustomAccordion";
import { CVListItem } from "src/CV/CVService/CVService.types";
import { ConversationPhase } from "src/chat/chatProgressbar/types";

const uniqueId = "cc7f354e-8aae-443d-a616-1aeda5fd931c";

export const DATA_TEST_ID = {
  UPLOADED_CVS_ACCORDION: `uploaded-cvs-accordion-${uniqueId}`,
  UPLOADED_CVS_ACCORDION_SUMMARY: `uploaded-cvs-accordion-summary-${uniqueId}`,
  UPLOADED_CVS_ACCORDION_DETAILS: `uploaded-cvs-accordion-details-${uniqueId}`,
  UPLOADED_CVS_DESCRIPTION_ICON: `uploaded-cvs-description-icon-${uniqueId}`,
  UPLOADED_CVS_FILE_NAME: `uploaded-cvs-file-name-${uniqueId}`,
  UPLOADED_CVS_UPLOAD_DATE: `uploaded-cvs-upload-date-${uniqueId}`,
};

interface UploadedCVsAccordionProps {
  items: CVListItem[];
  onSelect: (cv: CVListItem) => void;
  currentPhase?: ConversationPhase;
}

const UploadedCVsAccordion: React.FC<UploadedCVsAccordionProps> = ({ items, onSelect, currentPhase }) => {
  const theme = useTheme();
  const completedCVs = items.filter((cv) => cv.upload_process_state === "COMPLETED");
  const isCollectPhase = currentPhase === ConversationPhase.COLLECT_EXPERIENCES;

  // Different help text based on phase
  const helpTipText = isCollectPhase
    ? "Tap a CV to load its content into the text field. Review and send when you’re ready."
    : "CV selection is only available during the experience collection phase.";

  return (
    <Box display="flex" flexDirection="column" rowGap={theme.fixedSpacing(theme.tabiyaSpacing.md)}>
      <StyledAccordion data-testid={DATA_TEST_ID.UPLOADED_CVS_ACCORDION}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: theme.fixedSpacing(theme.tabiyaSpacing.md),
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="panel-content"
            id="panel-header"
            sx={{ flexGrow: 1 }}
            data-testid={DATA_TEST_ID.UPLOADED_CVS_ACCORDION_SUMMARY}
          >
            <Typography variant="caption" fontWeight="bold" color={theme.palette.text.primary}>
              {`Previously uploaded CVs (${completedCVs.length})`}
            </Typography>
          </AccordionSummary>
          <HelpTip icon={<InfoIcon />}>{helpTipText}</HelpTip>
        </Box>
        <AccordionDetails>
          {completedCVs.map((cv) => (
            <Box
              key={cv.upload_id}
              onClick={(e) => {
                if (!isCollectPhase) return;
                e.stopPropagation();
                onSelect(cv);
              }}
              sx={{
                display: "flex",
                alignItems: "center",
                columnGap: theme.fixedSpacing(theme.tabiyaSpacing.sm),
                px: theme.fixedSpacing(theme.tabiyaSpacing.md),
                "&:hover": {
                  backgroundColor: isCollectPhase ? theme.palette.action.hover : "transparent",
                  cursor: isCollectPhase ? "pointer" : "default",
                },
                opacity: isCollectPhase ? 1 : 0.5,
              }}
              data-testid={DATA_TEST_ID.UPLOADED_CVS_ACCORDION_DETAILS}
            >
              <DescriptionOutlinedIcon
                sx={{ color: theme.palette.text.secondary }}
                data-testid={DATA_TEST_ID.UPLOADED_CVS_DESCRIPTION_ICON}
              />
              <Box sx={{ display: "flex", flexDirection: "column" }}>
                <Typography variant="caption" color="secondary" data-testid={DATA_TEST_ID.UPLOADED_CVS_FILE_NAME}>
                  {cv.filename}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ fontSize: theme.fixedSpacing(theme.tabiyaSpacing.sm * 1.3) }}
                  data-testid={DATA_TEST_ID.UPLOADED_CVS_UPLOAD_DATE}
                >
                  {getDurationFromNow(new Date(cv.uploaded_at))}
                </Typography>
              </Box>
            </Box>
          ))}
        </AccordionDetails>
      </StyledAccordion>
      <Divider />
    </Box>
  );
};

export default UploadedCVsAccordion;
