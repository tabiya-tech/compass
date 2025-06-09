import React from "react";
import { Typography, useTheme } from "@mui/material";

interface QuestionTextProps {
  questionText: string;
}

const uniqueId = "bf2b8e40-5a77-4eac-a0ea-ba8af97a5d67";

export const DATA_TEST_ID = {
  QUESTION_TEXT: `question-text-${uniqueId}`,
};

const QuestionText: React.FC<QuestionTextProps> = ({ questionText }) => {
  const theme = useTheme();
  return (
    <Typography variant="body1" color={theme.palette.text.secondary} data-testid={DATA_TEST_ID.QUESTION_TEXT}>
      {questionText}
    </Typography>
  );
};

export default QuestionText;
