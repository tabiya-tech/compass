import * as React from "react";
import { useRef } from "react";
import { useMediaQuery, useTheme } from "@mui/material";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Rating from "@mui/material/Rating";
import { BaseQuestion } from "src/feedback/overallFeedback/feedbackForm/feedbackForm.types";
import QuestionText from "src/feedback/overallFeedback/feedbackForm/components/questionText/QuestionText";
import CommentTextField from "src/feedback/overallFeedback/feedbackForm/components/commentTextField/CommentTextField";
import { focusAndScrollToField } from "src/feedback/overallFeedback/feedbackForm/util";

export interface CustomRatingProps extends BaseQuestion {
  ratingValue: number | null;
  notifyChange: (value: number | null, comments?: string) => void;
  lowRatingLabel: string;
  highRatingLabel: string;
  comments?: string;
  displayRating?: boolean;
  maxRating: number;
  disabled?: boolean;
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
  disabled,
  maxRating,
  placeholder,
}) => {
  const theme = useTheme();
  const [commentText, setCommentText] = React.useState(comments ?? "");
  const isSmallMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const commentTextFieldRef = useRef<HTMLInputElement>(null);

  const handleRatingChange = (newValue: number | null) => {
    if (newValue !== null) {
      notifyChange(newValue, commentText);
      focusAndScrollToField(commentTextFieldRef);
    }
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
      gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
      data-testid={DATA_TEST_ID.CUSTOM_RATING_CONTAINER}
    >
      <Box display="flex" flexDirection="column" gap={theme.tabiyaSpacing.sm}>
        <QuestionText questionText={questionText} />
        {displayRating && (
          <Box display="flex" flexDirection="column" width="fit-content">
            <Rating
              data-testid={DATA_TEST_ID.CUSTOM_RATING_FIELD}
              name={questionId}
              value={ratingValue}
              onChange={(_, newValue) => handleRatingChange(newValue)}
              max={maxRating}
              precision={1}
              size="small"
              disabled={disabled}
              sx={{
                color: theme.palette.primary.main,
                "& .MuiSvgIcon-root": {
                  fontSize: isSmallMobile
                    ? theme.fixedSpacing(theme.tabiyaSpacing.lg)
                    : theme.fixedSpacing(theme.tabiyaSpacing.xl),
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
                paddingX: 0.5,
              }}
            >
              <Typography
                variant="body2"
                data-testid={DATA_TEST_ID.CUSTOM_RATING_LOW_LABEL}
                sx={{ fontSize: theme.fixedSpacing(theme.tabiyaSpacing.sm * 1.2) }}
              >
                {lowRatingLabel}
              </Typography>
              <Typography
                variant="body2"
                data-testid={DATA_TEST_ID.CUSTOM_RATING_HIGH_LABEL}
                sx={{ fontSize: theme.fixedSpacing(theme.tabiyaSpacing.sm * 1.2) }}
              >
                {highRatingLabel}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
      {placeholder && (
        <CommentTextField
          placeholder={placeholder}
          value={commentText}
          ref={commentTextFieldRef}
          onChange={handleCommentChange}
        />
      )}
    </Box>
  );
};

export default CustomRating;
