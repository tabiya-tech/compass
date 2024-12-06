import * as React from "react";
import { useTheme } from "@mui/material";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Rating from "@mui/material/Rating";
import { BaseQuestion } from "src/feedback/feedbackForm/feedback.types";
import QuestionText from "src/feedback/feedbackForm/components/questionText/QuestionText";
import CommentTextField from "src/feedback/feedbackForm/components/commentTextField/CommentTextField";

export interface CustomRatingProps extends BaseQuestion {
  ratingValue: number | null;
  notifyChange: (value: number | null, comments?: string) => void;
  lowRatingLabel: string;
  highRatingLabel: string;
  comments?: string;
  displayRating?: boolean;
  maxRating: number;
}

const uniqueId = "7bb1da6e-bd0f-4edf-bbbb-ff7ade168944";

export const DATA_TEST_ID = {
  CUSTOM_RATING_CONTAINER: `custom-rating-container-${uniqueId}`,
  CUSTOM_RATING_ICON: `custom-rating-icon-${uniqueId}`,
  CUSTOM_RATING_FIELD: `custom-rating-field-${uniqueId}`,
  CUSTOM_RATING_LOW_LABEL: `custom-rating-low-label-${uniqueId}`,
  CUSTOM_RATING_HIGH_LABEL: `custom-rating-high-label-${uniqueId}`,
};

const CustomRating: React.FC<CustomRatingProps> = ({
  questionId,
  ratingValue,
  notifyChange,
  questionText,
  lowRatingLabel,
  highRatingLabel,
  comments,
  displayRating = true,
  maxRating,
  placeholder
}) => {
  const theme = useTheme();
  const [commentText, setCommentText] = React.useState(comments || "");

  const handleRatingChange = (newValue: number | null) => {
    notifyChange(newValue, commentText);
  };

  const handleCommentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newCommentText = event.target.value;
    setCommentText(newCommentText);
    notifyChange(ratingValue, newCommentText);
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      gap={theme.spacing(2)}
      data-testid={DATA_TEST_ID.CUSTOM_RATING_CONTAINER}
    >
      <Box display="flex" flexDirection="column" gap={theme.tabiyaSpacing.sm}>
        <QuestionText questionText={questionText} />
        {displayRating && (
          <Box display="flex" flexDirection="column" width="fit-content">
            <Rating
              name={questionId}
              value={ratingValue}
              onChange={(_, newValue) => handleRatingChange(newValue)}
              max={maxRating}
              precision={1}
              size="small"
              sx={{
                color: theme.palette.primary.main,
                "& .MuiSvgIcon-root": {
                  fontSize: theme.fixedSpacing(theme.tabiyaSpacing.xl),
                },
              }}
              IconContainerComponent={(props: any) => {
                return <span {...props} data-testid={DATA_TEST_ID.CUSTOM_RATING_ICON} />;
              }}
            />
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                paddingX: 0.5,
                color: theme.palette.text.secondary,
              }}
            >
              <Typography variant="caption" data-testid={DATA_TEST_ID.CUSTOM_RATING_LOW_LABEL}
                          sx={{ fontSize: theme.fixedSpacing(theme.tabiyaSpacing.sm) }}>
                {lowRatingLabel}
              </Typography>
              <Typography variant="caption" data-testid={DATA_TEST_ID.CUSTOM_RATING_HIGH_LABEL}
                          sx={{ fontSize: theme.fixedSpacing(theme.tabiyaSpacing.sm) }}>
                {highRatingLabel}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
      {
        placeholder && (
          <CommentTextField
            placeholder={placeholder}
            value={commentText}
            onChange={handleCommentChange}
          />
        )
      }
    </Box>
  );
};

export default CustomRating;
