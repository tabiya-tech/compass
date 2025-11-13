import React, { useContext } from "react";
import { useTranslation } from "react-i18next";
import { Box, Popover, Typography, useTheme } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { DislikeReason, DislikeReasonMessages } from "src/chat/reaction/reaction.types";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";

export interface DislikeReasonPopoverProps {
  anchorEl: HTMLElement | null; // It allows the popover to know which element to attach to and appear next to.
  open: boolean;
  onClose: (reasons: DislikeReason[]) => void;
}

const uniqueId = "9f3e2d1c-8b7a-4c6d-a5e9-2f1d8c7b3a4e";

export const DATA_TEST_ID = {
  POPOVER: `dislike-reason-popover-${uniqueId}`,
  CONTAINER: `dislike-reason-popover-container-${uniqueId}`,
  TITLE: `dislike-reason-popover-title-${uniqueId}`,
  BUTTON: `dislike-reason-popover-button-${uniqueId}`,
  CLOSE_ICON: `dislike-reason-popover-close-button-${uniqueId}`,
  CLOSE_ICON_BUTTON: `dislike-reason-popover-close-icon-button-${uniqueId}`,
};

export const DislikeReasonPopover: React.FC<DislikeReasonPopoverProps> = ({
  anchorEl,
  open,
  onClose,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isOnline = useContext(IsOnlineContext)

  const handleReasonClick = (reason: DislikeReason) => {
    // for now, our ui only allows selecting one reason
    onClose([reason]);
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
      onClose={() => onClose([])}
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
            {t("chat.reaction.components.dislikeReasonPopover.title")}
          </Typography>
          <PrimaryIconButton
            onClick={() => onClose([])} // close without selecting a reason
            title={t("chat.reaction.components.dislikeReasonPopover.closeButton")}
            sx={{ color: theme.palette.text.secondary }}
            data-testid={DATA_TEST_ID.CLOSE_ICON_BUTTON}
          >
            <CloseIcon data-testid={DATA_TEST_ID.CLOSE_ICON} />
          </PrimaryIconButton>
        </Box>
        <Box display="flex" flexDirection="row" flexWrap="wrap" gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
          {Object.entries(DislikeReasonMessages).map(([enumValue, message]) => {
            // Convert SNAKE_CASE to camelCase (e.g., INAPPROPRIATE_TONE -> inappropriateTone)
            const camelCaseKey = enumValue.split('_').map((word, index) => {
              const lower = word.toLowerCase();
              return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
            }).join('');
            const translationKey = `chat.reaction.components.dislikeReasonPopover.reasons.${camelCaseKey}`;
            
            return (
              <PrimaryButton
                key={enumValue}
                onClick={() => handleReasonClick(enumValue as DislikeReason)}
                title={t(translationKey)}
                style={{ color: theme.palette.text.secondary }}
                data-testid={DATA_TEST_ID.BUTTON}
                disabled={!isOnline}
              >
                {t(translationKey)}
              </PrimaryButton>
            );
          })}
        </Box>
      </Box>
    </Popover>
  );
};

export default DislikeReasonPopover;
