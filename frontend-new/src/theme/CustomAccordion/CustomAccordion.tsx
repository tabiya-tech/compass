import React from "react";
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from "@mui/material";
import { styled } from "@mui/system";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HelpTip from "src/theme/HelpTip/HelpTip";
import PrivacyTipIcon from "@mui/icons-material/PrivacyTip";

export const StyledAccordion = styled(Accordion)({
  "&.MuiAccordion-root": {
    border: "none",
    boxShadow: "none",
    "&.Mui-expanded": {
      margin: 0,
    },
  },
  "&:before": {
    display: "none",
  },
  "& .MuiAccordionSummary-root": {
    display: "flex",
    gap: 2,
    padding: 0,
    margin: 0,
    minHeight: 0,
    "&.Mui-expanded": {
      minHeight: 0,
    },
  },
  "& .MuiAccordionSummary-content": {
    margin: 0,
    "&.Mui-expanded": {
      margin: 0,
    },
  },
  "& .MuiAccordionDetails-root": {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 0,
    paddingTop: 10,
  },
});

interface CustomAccordionProps {
  title: string;
  tooltipText: string;
  children: React.ReactNode;
}

const uniqueId = "34d24bf6-1b9b-40f1-93b3-baf68ab03da4";

export const DATA_TEST_ID = {
  CUSTOM_ACCORDION_CONTAINER: `custom-accordion-container-${uniqueId}`,
  CUSTOM_ACCORDION_SUMMARY: `custom-accordion-summary-${uniqueId}`,
  CUSTOM_ACCORDION_DETAILS: `custom-accordion-details-${uniqueId}`,
  CUSTOM_ACCORDION_HELP_TIP: `custom-accordion-help-tip-${uniqueId}`,
};

const CustomAccordion: React.FC<CustomAccordionProps> = ({ title, tooltipText, children }) => {
  return (
    <StyledAccordion data-testid={DATA_TEST_ID.CUSTOM_ACCORDION_CONTAINER}>
      <Box display="flex" alignItems="center">
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel-content"
          id="panel-header"
          sx={{ flexGrow: 1 }}
          data-testid={DATA_TEST_ID.CUSTOM_ACCORDION_SUMMARY}
        >
          <Typography variant="body1" fontWeight="bold">
            {title}
          </Typography>
        </AccordionSummary>
        <HelpTip icon={<PrivacyTipIcon />} data-testid={DATA_TEST_ID.CUSTOM_ACCORDION_HELP_TIP}>
          {tooltipText}
        </HelpTip>
      </Box>
      <AccordionDetails data-testid={DATA_TEST_ID.CUSTOM_ACCORDION_DETAILS}>{children}</AccordionDetails>
    </StyledAccordion>
  );
};

export default CustomAccordion;
