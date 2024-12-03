import React, { useState, useEffect } from "react";
import { Checkbox, FormControl, FormControlLabel, FormGroup, TextField, FormLabel } from "@mui/material";
import { BaseQuestion, Option } from "src/feedback/feedbackForm/feedback.types";

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
}) => {
  const [checkedOptions, setCheckedOptions] = useState<string[]>(selectedOptions);
  const [commentText, setCommentText] = useState(comments || "");

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
    <FormControl component="fieldset" fullWidth margin="normal" data-testid={DATA_TEST_ID.FORM_CONTROL}>
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
      <FormGroup>
        {options?.map((option) => (
          <FormControlLabel
            key={option.key}
            control={
              <Checkbox
                checked={checkedOptions.includes(option.key)}
                onChange={() => handleCheckboxChange(option.key)}
                data-testid={DATA_TEST_ID.CHECKBOX_OPTION}
              />
            }
            label={option.value}
          />
        ))}
      </FormGroup>
      {checkedOptions.length > 0 && (
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

export default CheckboxQuestion;
