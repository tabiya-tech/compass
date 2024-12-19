import React from "react";
import { Box, Popover, Typography, useTheme } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { ReactionReason, ReactReasonMessages } from "src/feedback/reaction/reaction.types";

export interface ReactionReasonPopoverProps {
  anchorEl: HTMLElement | null; // It allows the popover to know which element to attach to and appear next to.
  open: boolean;
  onClose: () => void;
  onReasonSelect: (reason: string) => void;
}

const uniqueId = "9f3e2d1c-8b7a-4c6d-a5e9-2f1d8c7b3a4e";

export const DATA_TEST_ID = {
  POPOVER: `reaction-reason-popover-${uniqueId}`,
  CONTAINER: `reaction-reason-popover-container-${uniqueId}`,
  TITLE: `reaction-reason-popover-title-${uniqueId}`,
  BUTTON: `reaction-reason-popover-button-${uniqueId}`,
  CLOSE_ICON: `reaction-reason-popover-close-button-${uniqueId}`,
  CLOSE_ICON_BUTTON: `reaction-reason-popover-close-icon-button-${uniqueId}`,
};

export const ReactionReasonPopover: React.FC<ReactionReasonPopoverProps> = ({
  anchorEl,
  open,
  onClose,
  onReasonSelect,
  ...props
}) => {
  const theme = useTheme();

  const handleReasonClick = (reason: string) => {
    onReasonSelect(reason);
    onClose();
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "center",
      }}
      transformOrigin={{
        vertical: "top",
        horizontal: "center",
      }}
      onClose={onClose}
      data-testid={DATA_TEST_ID.POPOVER}
    >
      <Box
        display="flex"
        flexDirection="column"
        maxWidth={400}
        gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
        sx={{ padding: theme.fixedSpacing(theme.tabiyaSpacing.lg) }}
        data-testid={DATA_TEST_ID.CONTAINER}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle1" color={theme.palette.text.secondary} data-testid={DATA_TEST_ID.TITLE}>
            Please tell us what the issue is?
          </Typography>
          <PrimaryIconButton
            onClick={onClose}
            title="close feedback"
            sx={{ color: theme.palette.text.secondary }}
            data-testid={DATA_TEST_ID.CLOSE_ICON_BUTTON}
          >
            <CloseIcon data-testid={DATA_TEST_ID.CLOSE_ICON} />
          </PrimaryIconButton>
        </Box>
        <Box display="flex" flexDirection="row" flexWrap="wrap" gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
          {Object.values(ReactionReason).map((reason) => (
            <PrimaryButton
              key={reason}
              onClick={() => handleReasonClick(reason)}
              title={reason}
              style={{ color: theme.palette.text.secondary }}
              data-testid={DATA_TEST_ID.BUTTON}
            >
              {ReactReasonMessages[reason]}
            </PrimaryButton>
          ))}
        </Box>
      </Box>
    </Popover>
  );
};

export default ReactionReasonPopover;
