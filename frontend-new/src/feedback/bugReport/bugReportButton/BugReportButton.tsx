import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import * as Sentry from "@sentry/react";
import { Box, styled, useMediaQuery, Theme } from "@mui/material";
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
  const { t } = useTranslation();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));
  const [sentryEnabled, setSentryEnabled] = useState(false);

  useEffect(() => {
    setSentryEnabled(Sentry.isInitialized());
  }, []);

  const handleOpenBugReport = useCallback(async () => {
    if (!sentryEnabled) {
      return;
    }

    try {
      const feedback = Sentry.getFeedback();
      if (!feedback) {
        return;
      }

      const form = await feedback.createForm({
        formTitle: t("chat.chatHeader.giveGeneralFeedback"),
        nameLabel: t("chat.chatHeader.nameLabel"),
        namePlaceholder: t("chat.chatHeader.namePlaceholder"),
        emailLabel: t("chat.chatHeader.emailLabel"),
        emailPlaceholder: t("chat.chatHeader.emailPlaceholder"),
        isRequiredLabel: t("chat.chatHeader.requiredLabel"),
        messageLabel: t("chat.chatHeader.descriptionLabel"),
        messagePlaceholder: t("chat.chatHeader.feedbackMessagePlaceholder"),
        addScreenshotButtonLabel: t("chat.chatHeader.addScreenshot"),
        submitButtonLabel: t("chat.chatHeader.sendFeedback"),
        cancelButtonLabel: t("chat.chatHeader.cancelButton"),
        successMessageText: t("chat.chatHeader.feedbackSuccessMessage"),
      });

      if (form) {
        form.appendToDom();
        form.open();
      }
    } catch (error) {
      console.error("Error creating bug report form:", error);
    }
  }, [sentryEnabled, t]);

  return (
    sentryEnabled && (
      <Box
        data-testid={DATA_TEST_ID.BUG_REPORT_BUTTON_CONTAINER}
        className={className}
        sx={{
          position: bottomAlign ? "fixed" : "auto",
          bottom: (theme) => (bottomAlign ? theme.spacing(theme.tabiyaSpacing.lg) : "auto"),
          right: (theme) => (bottomAlign ? theme.spacing(theme.tabiyaSpacing.lg) : "auto"),
          zIndex: (theme) => Math.max(theme.zIndex.drawer, theme.zIndex.modal) + 1,
        }}
      >
        {isMobile ? (
          <StyledPrimaryIconButton
            title={t("feedback.bugReport.reportBug")}
            data-testid={DATA_TEST_ID.BUG_REPORT_BUTTON}
            onClick={handleOpenBugReport}
          >
            <BugReport data-testid={DATA_TEST_ID.BUG_REPORT_ICON} />
          </StyledPrimaryIconButton>
        ) : (
          <PrimaryButton
            disableWhenOffline={true}
            startIcon={<BugReport data-testid={DATA_TEST_ID.BUG_REPORT_ICON} />}
            title={t("feedback.bugReport.reportBug") + "."}
            data-testid={DATA_TEST_ID.BUG_REPORT_BUTTON}
            onClick={handleOpenBugReport}
          >
            {t("feedback.bugReport.reportBug")}
          </PrimaryButton>
        )}
      </Box>
    )
  );
};

export default BugReportButton;
