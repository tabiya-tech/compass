import React, { useEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/react";
import { Box, styled, useMediaQuery, useTheme } from "@mui/material";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import { BugReport } from "@mui/icons-material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";

interface BugReportButtonProps {
  className?: string;
  bottomAlign?: boolean;
}

const uniqueId = "31d2b110-8308-4035-90a6-519e89e7f6fa";

export const DATA_TEST_ID = {
  BUG_REPORT_BUTTON_CONTAINER: `bug-report-button-container-${uniqueId}`,
  BUG_REPORT_BUTTON: `bug-report-button-${uniqueId}`,
  BUG_REPORT_ICON: `bug-report-icon-${uniqueId}`,
};

const StyledPrimaryIconButton = styled(PrimaryIconButton)(({ theme }) => ({
  borderRadius: theme.spacing(theme.tabiyaSpacing.sm),
  lineHeight: "0",
  padding: theme.spacing(theme.tabiyaSpacing.xs),
  color: theme.palette.common.black,
  ":hover": {
    backgroundColor: theme.palette.secondary.dark,
    color: theme.palette.secondary.contrastText,
    border: "none",
  },
  ":active": {
    backgroundColor: theme.palette.primary.dark,
    color: theme.palette.secondary.contrastText,
    border: "none",
  },
}));

const BugReportButton: React.FC<BugReportButtonProps> = ({ bottomAlign, className }) => {
  const [bugReport, setBugReport] = useState<any>();
  const buttonRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [sentryEnabled, setSentryEnabled] = useState(false);

  useEffect(() => {
    setSentryEnabled(Sentry.isInitialized());
  }, []);

  useEffect(() => {
    if (sentryEnabled) {
      setBugReport(Sentry.getFeedback());
    }
  }, [sentryEnabled]);

  useEffect(() => {
    if (bugReport && buttonRef.current) {
      return bugReport.attachTo(buttonRef.current);
    }
  }, [bugReport]);

  return (
    sentryEnabled && (
      <Box
        ref={buttonRef}
        data-testid={DATA_TEST_ID.BUG_REPORT_BUTTON_CONTAINER}
        className={className}
        sx={{
          position: bottomAlign ? "fixed" : "auto",
          bottom: bottomAlign ? theme.spacing(theme.tabiyaSpacing.lg) : "auto",
          right: bottomAlign ? theme.spacing(theme.tabiyaSpacing.lg) : "auto",
        }}
      >
        {" "}
        {isMobile ? (
          <StyledPrimaryIconButton title={"Report a bug."} data-testid={DATA_TEST_ID.BUG_REPORT_BUTTON}>
            <BugReport data-testid={DATA_TEST_ID.BUG_REPORT_ICON} />
          </StyledPrimaryIconButton>
        ) : (
          <PrimaryButton
            disableWhenOffline={true}
            startIcon={<BugReport data-testid={DATA_TEST_ID.BUG_REPORT_ICON} />}
            title={"Report a bug."}
            data-testid={DATA_TEST_ID.BUG_REPORT_BUTTON}
          >
            Report a bug
          </PrimaryButton>
        )}
      </Box>
    )
  );
};

export default BugReportButton;