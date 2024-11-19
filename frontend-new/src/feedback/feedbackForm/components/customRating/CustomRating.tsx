import * as React from "react";
import { useMediaQuery, useTheme } from "@mui/material";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Rating from "@mui/material/Rating";
import TextField from "@mui/material/TextField";
import { BaseQuestion, } from "src/feedback/feedbackForm/feedback.types";

export interface CustomRatingProps extends BaseQuestion {
  ratingValue: number | null;
  notifyChange: (value: number| null, comments?: string) => void;
  lowRatingLabel: string;
  highRatingLabel: string;
  comments?: string;
  displayRating?: boolean;
}

const uniqueId = "7bb1da6e-bd0f-4edf-bbbb-ff7ade168944";

export const DATA_TEST_ID = {
  CUSTOM_RATING_CONTAINER: `custom-rating-container-${uniqueId}`,
  CUSTOM_RATING_TEXT: `custom-rating-text-${uniqueId}`,
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
  }) => {
  const theme = useTheme();
  const [commentText, setCommentText] = React.useState(comments || "");
  const isSmallMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const handleRatingChange = (newValue: number | null) => {
    notifyChange(newValue, commentText);
  };

  const handleCommentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newCommentText = event.target.value;
    setCommentText(newCommentText);
    notifyChange(ratingValue, newCommentText);
  };

  return (
    <Box display="flex" flexDirection="column" gap={theme.spacing(2)}
         data-testid={DATA_TEST_ID.CUSTOM_RATING_CONTAINER}>
      <Box display="flex" flexDirection="column" gap={theme.spacing(1)}>
        <Typography variant="subtitle1" color={theme => theme.palette.text.secondary}
                    data-testid={DATA_TEST_ID.CUSTOM_RATING_TEXT}>{questionText}</Typography>
        {displayRating && (<Box display="flex" flexDirection="column" width="fit-content">
            <Rating
              name={questionId}
              value={ratingValue}
              onChange={(_, newValue) => handleRatingChange(newValue)}
              max={10}
              precision={1}
              size="small"
              sx={{
                color: theme.palette.primary.main,
                "& .MuiSvgIcon-root": {
                  fontSize: theme.fixedSpacing(isSmallMobile ? theme.tabiyaSpacing.lg : theme.tabiyaSpacing.xl),
                },
              }}
              IconContainerComponent ={(props: any) => {
                return <span {...props} data-testid={DATA_TEST_ID.CUSTOM_RATING_ICON} />;
              }}
            />
            <Box sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              paddingX: 0.5,
              color: theme.palette.text.secondary,
            }}>
              <Typography variant="caption"
                          data-testid={DATA_TEST_ID.CUSTOM_RATING_LOW_LABEL}>{lowRatingLabel}</Typography>
              <Typography variant="caption"
                          data-testid={DATA_TEST_ID.CUSTOM_RATING_HIGH_LABEL}>{highRatingLabel}</Typography>
            </Box>
          </Box>
        )}
      </Box>
      <TextField
        placeholder="Write your message here!"
        multiline
        fullWidth
        rows={2}
        variant="outlined"
        value={commentText}
        onChange={handleCommentChange}
        inputProps={{ "data-testid": DATA_TEST_ID.CUSTOM_RATING_FIELD }}
      />
    </Box>
  );
};

export default CustomRating;