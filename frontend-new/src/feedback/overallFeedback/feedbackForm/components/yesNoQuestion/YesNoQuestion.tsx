import React, { useState, useEffect, useCallback, useRef } from "react";
import { FormControl, FormControlLabel, FormLabel, Radio, RadioGroup, useTheme } from "@mui/material";
import { BaseQuestion, YesNoEnum } from "src/feedback/overallFeedback/feedbackForm/feedbackForm.types";
import QuestionText from "src/feedback/overallFeedback/feedbackForm/components/questionText/QuestionText";
import CommentTextField from "src/feedback/overallFeedback/feedbackForm/components/commentTextField/CommentTextField";
import { focusAndScrollToField } from "src/feedback/overallFeedback/feedbackForm/util";

export interface YesNoQuestionProps extends BaseQuestion {
  ratingValue: boolean | null;
  notifyChange: (value: boolean | null, comments?: string) => void;
  comments?: string;
  showCommentsOn: YesNoEnum | undefined; // defines which answer that shows the comments
}

const uniqueId = "9803f91b-499a-41b3-9348-795de9e399a9";

export const DATA_TEST_ID = {
  FORM_CONTROL: `yes-no-question-form-control-${uniqueId}`,
  FORM_LABEL: `yes-no-question-form-label-${uniqueId}`,
  RADIO_YES: `yes-no-question-radio-yes-${uniqueId}`,
  RADIO_NO: `yes-no-question-radio-no-${uniqueId}`,
  TEXT_FIELD: `yes-no-question-text-field-${uniqueId}`,
};

const YesNoQuestion: React.FC<YesNoQuestionProps> = ({
  questionText,
  questionId,
  ratingValue,
  notifyChange,
  comments,
  showCommentsOn,
  placeholder,
}) => {
  // function to determine if comments should be shown
  const shouldShowComments = useCallback(
    (value: boolean | null) =>
      (showCommentsOn === YesNoEnum.Yes && value === true) || (showCommentsOn === YesNoEnum.No && value === false),
    [showCommentsOn]
  );

  const theme = useTheme();
  const [showComments, setShowComments] = useState(shouldShowComments(ratingValue));
  const [commentText, setCommentText] = useState(comments ?? "");
  const commentTextFieldRef = useRef<HTMLInputElement>(null);

  // focus on comment text field when text field is shown
  useEffect(() => {
    if (showComments) {
      focusAndScrollToField(commentTextFieldRef);
    }
  }, [showComments]);

  useEffect(() => {
    setShowComments(shouldShowComments(ratingValue));
  }, [ratingValue, showCommentsOn, shouldShowComments]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value === "true";
    notifyChange(newValue, commentText);
    setShowComments(shouldShowComments(newValue));
  };

  const handleCommentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newComments = event.target.value;
    setCommentText(newComments);
    notifyChange(ratingValue, newComments);
  };

  return (
    <FormControl
      component="fieldset"
      fullWidth
      margin="normal"
      sx={{ display: "flex", flexDirection: "column", gap: 1, margin: 0 }}
      data-testid={DATA_TEST_ID.FORM_CONTROL}
    >
      <FormLabel component="legend" data-testid={DATA_TEST_ID.FORM_LABEL}>
        <QuestionText questionText={questionText} />
      </FormLabel>
      <RadioGroup
        aria-label={questionId}
        name={questionId}
        value={ratingValue ?? ""}
        onChange={handleChange}
        row
        sx={{
          display: "flex",
          gap: theme.fixedSpacing(theme.tabiyaSpacing.lg),
          marginTop: theme.tabiyaSpacing.md,
        }}
      >
        <FormControlLabel
          value="false"
          control={<Radio sx={{ padding: 0 }} />}
          label="No"
          data-testid={DATA_TEST_ID.RADIO_NO}
          sx={{ margin: 0 }}
        />
        <FormControlLabel
          value="true"
          control={<Radio sx={{ padding: 0 }} />}
          label="Yes"
          data-testid={DATA_TEST_ID.RADIO_YES}
          sx={{ margin: 0 }}
        />
      </RadioGroup>
      {showComments && (
        <CommentTextField
          placeholder={placeholder}
          value={commentText}
          ref={commentTextFieldRef}
          onChange={handleCommentChange}
        />
      )}
    </FormControl>
  );
};

export default YesNoQuestion;
