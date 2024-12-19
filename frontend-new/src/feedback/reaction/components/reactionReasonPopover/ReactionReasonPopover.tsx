import React from "react";
import { Box, Popover, Typography, useTheme } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { ReactionReason } from "src/feedback/reaction/reaction.types";

export interface ReactionReasonPopoverProps {
  messageId: string;
  dataTestId: string;
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onReasonSelect: (messageId: string, reason: string) => void;
}

const uniqueId = "9f3e2d1c-8b7a-4c6d-a5e9-2f1d8c7b3a4e";

export const DATA_TEST_ID = {
  REACTION_REASON_CONTAINER: `reaction-reason-container-${uniqueId}`,
  REACTION_REASON_BUTTON: `reaction-reason-button-${uniqueId}`,
  REACTION_REASON_CLOSE_ICON: `reaction-reason-close-button-${uniqueId}`,
};

export const ReactionReasonPopover: React.FC<ReactionReasonPopoverProps> = ({
  messageId,
  anchorEl,
  open,
  onClose,
  onReasonSelect,
  ...props
}) => {
  const theme = useTheme();

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
    >
      <Box
        display="flex"
        flexDirection="column"
        maxWidth={400}
        gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
        sx={{ padding: theme.fixedSpacing(theme.tabiyaSpacing.lg) }}
        data-testid={DATA_TEST_ID.REACTION_REASON_CONTAINER}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle1" color={theme.palette.text.secondary}>
            Please tell us what the issue is?
          </Typography>
          <PrimaryIconButton
            onClick={onClose}
            title="close feedback"
            sx={{ color: theme.palette.text.secondary }}
            data-testid={DATA_TEST_ID.REACTION_REASON_CLOSE_ICON}
          >
            <CloseIcon />
          </PrimaryIconButton>
        </Box>
        <Box display="flex" flexDirection="row" flexWrap="wrap" gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
          {Object.values(ReactionReason).map((reason, index) => (
            <PrimaryButton
              key={index}
              onClick={() => {
                onReasonSelect(messageId, reason);
                onClose();
              }}
              title={reason}
              style={{ color: theme.palette.text.secondary }}
              data-testid={DATA_TEST_ID.REACTION_REASON_BUTTON}
            >
              {reason}
            </PrimaryButton>
          ))}
        </Box>
      </Box>
    </Popover>
  );
};

export default ReactionReasonPopover;
