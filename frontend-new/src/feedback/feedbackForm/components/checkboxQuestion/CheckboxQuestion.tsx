import React, { useState, useEffect, useRef } from "react";
import { Checkbox, FormControl, FormControlLabel, FormGroup, FormLabel, useTheme } from "@mui/material";
import { BaseQuestion, Option } from "src/feedback/feedbackForm/feedback.types";
import QuestionText from "src/feedback/feedbackForm/components/questionText/QuestionText";
import CommentTextField from "src/feedback/feedbackForm/components/commentTextField/CommentTextField";
import { focusAndScrollToField } from "src/feedback/feedbackForm/util";

export interface CheckboxQuestionProps extends BaseQuestion {
  selectedOptions: string[];
  notifyChange: (selectedOptions: string[], comments?: string) => void;
  options: Option[];
  comments?: string;
}

const uniqueId = "989402f0-9fda-4400-958c-2d6c7bce9821";

export const DATA_TEST_ID = {
  FORM_CONTROL: `checkbox-with-textarea-form-control-${uniqueId}`,
  FORM_LABEL: `checkbox-with-textarea-form-label-${uniqueId}`,
  CHECKBOX_OPTION: `checkbox-with-textarea-checkbox-option-${uniqueId}`,
  TEXT_FIELD: `checkbox-with-textarea-text-field-${uniqueId}`,
};

const CheckboxQuestion: React.FC<CheckboxQuestionProps> = ({
  questionText,
  selectedOptions,
  notifyChange,
  options,
  comments,
  placeholder,
}) => {
  const theme = useTheme();
  const [checkedOptions, setCheckedOptions] = useState<string[]>(selectedOptions);
  const [commentText, setCommentText] = useState(comments ?? "");
  const commentTextFieldRef = useRef<HTMLInputElement>(null);

  // focus on comment text field when text field is shown
  useEffect(() => {
    if (checkedOptions.length > 0) {
      focusAndScrollToField(commentTextFieldRef);
    }
  }, [checkedOptions]);

  useEffect(() => {
    setCheckedOptions(selectedOptions);
  }, [selectedOptions]);

  const handleCheckboxChange = (optionKey: string) => {
    const newCheckedOptions = checkedOptions.includes(optionKey)
      ? checkedOptions.filter((checkedOption) => checkedOption !== optionKey)
      : [...checkedOptions, optionKey];

    setCheckedOptions(newCheckedOptions);
    notifyChange(newCheckedOptions, commentText);
  };

  const handleCommentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newComments = event.target.value;
    setCommentText(newComments);
    notifyChange(checkedOptions, newComments);
  };

  return (
    <FormControl
      component="fieldset"
      fullWidth
      margin="normal"
      sx={{ margin: 0, display: "flex", flexDirection: "column", gap: theme.tabiyaSpacing.md }}
      data-testid={DATA_TEST_ID.FORM_CONTROL}
    >
      <FormLabel component="legend" data-testid={DATA_TEST_ID.FORM_LABEL}>
        <QuestionText questionText={questionText} />
      </FormLabel>
      <FormGroup
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: theme.tabiyaSpacing.sm,
          marginTop: theme.tabiyaSpacing.md,
        }}
      >
        {options?.map((option) => (
          <FormControlLabel
            key={option.key}
            control={
              <Checkbox
                checked={checkedOptions.includes(option.key)}
                onChange={() => handleCheckboxChange(option.key)}
                data-testid={DATA_TEST_ID.CHECKBOX_OPTION}
                sx={{ padding: 0, marginRight: theme.tabiyaSpacing.sm }}
              />
            }
            label={option.value}
            sx={{ margin: 0, width: "fit-content" }}
          />
        ))}
      </FormGroup>
      {checkedOptions.length > 0 && (
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

export default CheckboxQuestion;
