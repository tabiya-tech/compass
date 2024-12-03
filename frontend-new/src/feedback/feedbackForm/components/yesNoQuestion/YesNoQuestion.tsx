import React, { useState, useEffect, useCallback } from "react";
import { FormControl, FormControlLabel, FormLabel, Radio, RadioGroup, TextField } from "@mui/material";
import { BaseQuestion, YesNoEnum } from "src/feedback/feedbackForm/feedback.types";

export interface YesNoQuestionProps extends BaseQuestion {
  ratingValue: boolean | null;
  notifyChange: (value: boolean | null, comments?: string) => void;
  comments?: string;
  showCommentsOn: YesNoEnum | undefined;
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
}) => {
  // function to determine if comments should be shown
  const shouldShowComments = useCallback(
    (value: boolean | null) =>
      (showCommentsOn === YesNoEnum.Yes && value === true) || (showCommentsOn === YesNoEnum.No && value === false),
    [showCommentsOn]
  );

  const [showComments, setShowComments] = useState(shouldShowComments(ratingValue));
  const [commentText, setCommentText] = useState(comments ?? "");

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
      <FormLabel
        component="legend"
        sx={{
          fontSize: (theme) => theme.typography.subtitle1.fontSize,
          "&.Mui-focused": {
            color: (theme) => theme.palette.common.black,
          },
        }}
        data-testid={DATA_TEST_ID.FORM_LABEL}
      >
        {questionText}
      </FormLabel>
      <RadioGroup
        aria-label={questionId}
        name={questionId}
        value={ratingValue === null ? "" : ratingValue}
        onChange={handleChange}
        row
      >
        <FormControlLabel value="false" control={<Radio />} label="No" data-testid={DATA_TEST_ID.RADIO_NO} />
        <FormControlLabel value="true" control={<Radio />} label="Yes" data-testid={DATA_TEST_ID.RADIO_YES} />
      </RadioGroup>
      {showComments && (
        <TextField
          placeholder="Write your message here!"
          multiline
          fullWidth
          rows={2}
          variant="outlined"
          value={commentText}
          onChange={handleCommentChange}
          inputProps={{ "data-testid": DATA_TEST_ID.TEXT_FIELD }}
        />
      )}
    </FormControl>
  );
};

export default YesNoQuestion;
