import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, Typography, useTheme } from "@mui/material";
import { QuickReplyOption } from "src/chat/ChatService/ChatService.types";

const uniqueId = "quick-reply-buttons-3f7a8b2c";

export const DATA_TEST_ID = {
  QUICK_REPLY_CONTAINER: `quick-reply-container-${uniqueId}`,
  QUICK_REPLY_HEADER: `quick-reply-header-${uniqueId}`,
  QUICK_REPLY_BUTTON: `quick-reply-button-${uniqueId}`,
};

export interface QuickReplyButtonsProps {
  options: QuickReplyOption[];
  onSelect: (label: string) => void;
}

const QuickReplyButtons: React.FC<QuickReplyButtonsProps> = ({ options, onSelect }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  if (!options.length) return null;

  const showChooseOneCaption = options.length >= 2;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: theme.tabiyaSpacing.sm,
      }}
    >
      {showChooseOneCaption && (
        <Typography
          data-testid={DATA_TEST_ID.QUICK_REPLY_HEADER}
          sx={{
            fontWeight: theme.typography.fontWeightBold,
            fontSize: theme.typography.caption.fontSize,
            textTransform: "uppercase",
          }}
        >
          {t("chat.chatMessage.suggestedActions.quickReplyButtons.chooseOne")}
        </Typography>
      )}
      <Box
        data-testid={DATA_TEST_ID.QUICK_REPLY_CONTAINER}
        sx={{
          display: "flex",
          flexDirection: "row",
          maxWidth: 500,
          width: "100%",
          flexWrap: "wrap",
          gap: theme.tabiyaSpacing.sm,
        }}
      >
        {options.map((option) => (
          <Box key={option.label}>
            <Button
              variant="outlined"
              onClick={() => onSelect(option.label)}
              data-testid={DATA_TEST_ID.QUICK_REPLY_BUTTON}
              sx={{
                justifyContent: "flex-start",
                textAlign: "left",
                textTransform: "none",
                display: "inline !important",
                paddingX: theme.tabiyaSpacing.lg,
                paddingY: theme.tabiyaSpacing.sm,
                borderRadius: theme.tabiyaRounding.md,
                borderBottomRightRadius: 0,
                borderColor: theme.palette.grey[400],
                backgroundColor: theme.palette.grey[100],
                color: theme.palette.text.secondary,
                fontSize: theme.typography.body2.fontSize,
                fontWeight: theme.typography.fontWeightRegular,
                "&:hover": {
                  backgroundColor: theme.palette.grey[100],
                  borderColor: theme.palette.grey[500],
                },
              }}
            >
              {option.label}
            </Button>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default QuickReplyButtons;
