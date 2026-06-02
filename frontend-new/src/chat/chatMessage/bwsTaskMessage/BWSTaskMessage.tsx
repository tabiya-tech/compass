import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, Tooltip, Typography, LinearProgress, useTheme } from "@mui/material";
import { BWSAlternative, BWSTaskMessageProps } from "./BWSTaskMessage.types";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import BrandLogo from "src/chat/chatMessage/components/brandLogo/BrandLogo";

const uniqueId = "bws-task-message-3c9e8f21-47b2-4a1d-9d63-c7e2f1a85b04";

export const DATA_TEST_ID = {
  CONTAINER: `bws-task-container-${uniqueId}`,
  BRAND_LOGO: `bws-task-brand-logo-${uniqueId}`,
  DESCRIPTION_BOX: `bws-task-description-${uniqueId}`,
  MOST_ROW: `bws-task-most-row-${uniqueId}`,
  LEAST_ROW: `bws-task-least-row-${uniqueId}`,
  SUBMIT_BUTTON: `bws-task-submit-${uniqueId}`,
  LETTER_BUTTON: (letter: string, row: "most" | "least") => `bws-letter-${row}-${letter}-${uniqueId}`,
};

export const BWS_TASK_MESSAGE_TYPE = `bws-task-message-${uniqueId}`;

const LETTERS = ["A", "B", "C", "D", "E"] as const;
type Letter = (typeof LETTERS)[number];

const BWSTaskMessage: React.FC<BWSTaskMessageProps> = ({ taskId, taskNumber, totalTasks, alternatives, onSubmit }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [best, setBest] = useState<string | null>(null);
  const [worst, setWorst] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const progressPercent = Math.round(((taskNumber - 1) / totalTasks) * 100);

  const handleBest = (wa_id: string) => {
    if (submitted) return;
    setBest(wa_id);
    if (worst === wa_id) setWorst(null);
  };

  const handleWorst = (wa_id: string) => {
    if (submitted) return;
    setWorst(wa_id);
    if (best === wa_id) setBest(null);
  };

  const handleSubmit = () => {
    if (!best || !worst || submitted) return;
    setSubmitted(true);
    onSubmit(taskId, best, worst);
  };

  const getLetter = (idx: number): Letter => LETTERS[idx];

  const getAlternativeByLetter = (letter: Letter): BWSAlternative | undefined => alternatives[LETTERS.indexOf(letter)];

  // Compose the task description text shown in the top box
  const descriptionLines = alternatives.map((alt, idx) => `${getLetter(idx)}. ${alt.label}`).join("\n");

  return (
    <MessageContainer origin={ConversationMessageSender.COMPASS} data-testid={DATA_TEST_ID.CONTAINER}>
      <Box data-testid={DATA_TEST_ID.BRAND_LOGO}>
        <BrandLogo />
      </Box>
      <Box
        sx={{
          width: "fit-content",
          minWidth: "60%",
          maxWidth: "90%",
          display: "flex",
          flexDirection: "column",
          gap: theme.fixedSpacing(theme.tabiyaSpacing.sm),
        }}
      >
        {/* Description box */}
        <Box
          data-testid={DATA_TEST_ID.DESCRIPTION_BOX}
          sx={{
            border: `1px solid ${theme.palette.grey[300]}`,
            borderRadius: theme.fixedSpacing(theme.tabiyaRounding.sm),
            padding: theme.fixedSpacing(theme.tabiyaSpacing.sm),
            backgroundColor: theme.palette.pageBackground.light,
          }}
        >
          <Typography
            variant="body2"
            sx={{ whiteSpace: "pre-line", lineHeight: 1.7, color: theme.palette.text.primary }}
          >
            {descriptionLines}
          </Typography>
          <Typography
            variant="body2"
            sx={{ mt: theme.fixedSpacing(theme.tabiyaSpacing.xs), fontWeight: 600, color: theme.palette.text.primary }}
          >
            {t("chat.chatMessage.bwsTaskMessage.whichWouldYouPrefer")}
          </Typography>
        </Box>

        {/* Progress bar */}
        <Box sx={{ display: "flex", alignItems: "center", gap: theme.fixedSpacing(theme.tabiyaSpacing.xs) }}>
          <LinearProgress
            variant="determinate"
            value={progressPercent}
            sx={{
              flex: 1,
              height: 6,
              borderRadius: 9999,
              backgroundColor: theme.palette.grey[200],
              "& .MuiLinearProgress-bar": {
                backgroundColor: theme.palette.tabiyaBlue.main,
                borderRadius: 9999,
              },
            }}
          />
          <Typography variant="caption" sx={{ whiteSpace: "nowrap", color: theme.palette.text.secondary }}>
            {taskNumber} of {totalTasks}
          </Typography>
        </Box>

        {/* Most row */}
        <Box
          data-testid={DATA_TEST_ID.MOST_ROW}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: theme.fixedSpacing(theme.tabiyaSpacing.xs),
            border: `1px solid ${theme.palette.grey[300]}`,
            borderRadius: theme.fixedSpacing(theme.tabiyaRounding.sm),
            padding: `${theme.fixedSpacing(theme.tabiyaSpacing.xs)} ${theme.fixedSpacing(theme.tabiyaSpacing.sm)}`,
            backgroundColor: theme.palette.pageBackground.light,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 48, color: theme.palette.text.primary }}>
            {t("chat.chatMessage.bwsTaskMessage.most")}
          </Typography>
          {LETTERS.map((letter) => {
            const alt = getAlternativeByLetter(letter);
            if (!alt) return null;
            const isSelected = best === alt.wa_id;
            return (
              <Tooltip key={letter} title={submitted ? alt.label : isSelected ? alt.label : ""} arrow>
                <Button
                  data-testid={DATA_TEST_ID.LETTER_BUTTON(letter, "most")}
                  variant={isSelected ? "contained" : "outlined"}
                  size="small"
                  onClick={() => handleBest(alt.wa_id)}
                  disabled={submitted}
                  sx={{
                    minWidth: 36,
                    width: 36,
                    height: 36,
                    padding: 0,
                    borderRadius: theme.fixedSpacing(theme.tabiyaRounding.xs),
                    fontWeight: 600,
                    ...(isSelected
                      ? {
                          backgroundColor: theme.palette.tabiyaGreen.main,
                          borderColor: theme.palette.tabiyaGreen.main,
                          color: theme.palette.tabiyaGreen.contrastText,
                          "&:hover": {
                            backgroundColor: theme.palette.tabiyaGreen.dark,
                          },
                        }
                      : {
                          borderColor: theme.palette.grey[400],
                          color: theme.palette.text.primary,
                          "&:hover": {
                            borderColor: theme.palette.tabiyaGreen.main,
                            color: theme.palette.tabiyaGreen.main,
                          },
                        }),
                  }}
                >
                  {letter}
                </Button>
              </Tooltip>
            );
          })}
        </Box>

        {/* Least row */}
        <Box
          data-testid={DATA_TEST_ID.LEAST_ROW}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: theme.fixedSpacing(theme.tabiyaSpacing.xs),
            border: `1px solid ${theme.palette.grey[300]}`,
            borderRadius: theme.fixedSpacing(theme.tabiyaRounding.sm),
            padding: `${theme.fixedSpacing(theme.tabiyaSpacing.xs)} ${theme.fixedSpacing(theme.tabiyaSpacing.sm)}`,
            backgroundColor: theme.palette.pageBackground.light,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 48, color: theme.palette.text.primary }}>
            {t("chat.chatMessage.bwsTaskMessage.least")}
          </Typography>
          {LETTERS.map((letter) => {
            const alt = getAlternativeByLetter(letter);
            if (!alt) return null;
            const isSelected = worst === alt.wa_id;
            return (
              <Tooltip key={letter} title={submitted ? alt.label : isSelected ? alt.label : ""} arrow>
                <Button
                  data-testid={DATA_TEST_ID.LETTER_BUTTON(letter, "least")}
                  variant={isSelected ? "contained" : "outlined"}
                  size="small"
                  onClick={() => handleWorst(alt.wa_id)}
                  disabled={submitted}
                  sx={{
                    minWidth: 36,
                    width: 36,
                    height: 36,
                    padding: 0,
                    borderRadius: theme.fixedSpacing(theme.tabiyaRounding.xs),
                    fontWeight: 600,
                    ...(isSelected
                      ? {
                          backgroundColor: theme.palette.tabiyaRed.main,
                          borderColor: theme.palette.tabiyaRed.main,
                          color: theme.palette.tabiyaRed.contrastText,
                          "&:hover": {
                            backgroundColor: theme.palette.tabiyaRed.dark,
                          },
                        }
                      : {
                          borderColor: theme.palette.grey[400],
                          color: theme.palette.text.primary,
                          "&:hover": {
                            borderColor: theme.palette.tabiyaRed.main,
                            color: theme.palette.tabiyaRed.main,
                          },
                        }),
                  }}
                >
                  {letter}
                </Button>
              </Tooltip>
            );
          })}
        </Box>

        {/* Submit */}
        <Button
          data-testid={DATA_TEST_ID.SUBMIT_BUTTON}
          variant="contained"
          disabled={!best || !worst || submitted}
          onClick={handleSubmit}
          sx={{
            alignSelf: "flex-end",
            backgroundColor: theme.palette.tabiyaBlue.main,
            color: theme.palette.tabiyaBlue.contrastText,
            borderRadius: theme.fixedSpacing(theme.tabiyaRounding.sm),
            "&:hover": {
              backgroundColor: theme.palette.tabiyaBlue.dark,
            },
            "&.Mui-disabled": {
              backgroundColor: theme.palette.grey[300],
              color: theme.palette.grey[500],
            },
          }}
        >
          {submitted ? t("chat.chatMessage.bwsTaskMessage.submitted") : t("chat.chatMessage.bwsTaskMessage.submit")}
        </Button>
      </Box>
    </MessageContainer>
  );
};

export default BWSTaskMessage;
