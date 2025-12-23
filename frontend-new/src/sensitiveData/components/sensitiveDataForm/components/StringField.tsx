import React, { useState } from "react";
import { TextField, Typography, Box } from "@mui/material";
import debounce from "lodash.debounce";
import { StringFieldDefinition, DEBOUNCE_TIME } from "src/sensitiveData/components/sensitiveDataForm/config/types";

export const DATA_TEST_ID = {
  STRING_FIELD: "string-field",
  STRING_FIELD_QUESTION_TEXT: "string-field-question-text",
  STRING_FIELD_INPUT: "string-field-input",
  STRING_FIELD_HELPER_TEXT: "string-field-helper-text",
};

interface StringFieldProps {
  field: StringFieldDefinition;
  dataTestId: string;
  initialValue?: string;
  onChange: (value: string, isValid: boolean) => void;
}

/**
 * Component for rendering string input fields with validation
 */
const StringField: React.FC<StringFieldProps> = ({ field, dataTestId, initialValue = "", onChange }) => {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  // Simple validation function
  const validate = (input: string): { isValid: boolean; errorMessage: string | null } => {
    // Check if empty when required
    if (field.required && (!input || input.trim() === "")) {
      return {
        isValid: false,
        errorMessage: "This field is required",
      };
    }

    // Check pattern if provided and input is not empty
    if (field.validation?.pattern && input.trim() !== "") {
      // ensure unicode support for regex otherwise certain patterns wont work
      const regex = new RegExp(field.validation.pattern, "u");
      if (!regex.test(input)) {
        return {
          isValid: false,
          errorMessage: field.validation.errorMessage ?? "Invalid format",
        };
      }
    }

    return { isValid: true, errorMessage: null };
  };

  // Create debounced validation function
  const debouncedValidate = debounce((newValue: string) => {
    const { isValid, errorMessage } = validate(newValue);
    setError(errorMessage);
    onChange(newValue, isValid);
  }, DEBOUNCE_TIME);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Get and process the new value
    let newValue = e.target.value.trimStart();

    // Update the input value immediately for responsive feedback
    setValue(newValue);

    // Trigger debounced validation
    debouncedValidate(newValue);
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      gap={(theme) => theme.fixedSpacing(theme.tabiyaRounding.xs)}
      data-testid={DATA_TEST_ID.STRING_FIELD}
    >
      {field.questionText && (
        <Typography
          variant="caption"
          color="text.secondary"
          data-testid={DATA_TEST_ID.STRING_FIELD_QUESTION_TEXT}
          sx={{
            display: "block",
            lineHeight: 1.5,
            mb: 0.5,
            fontSize: "0.7rem",
          }}
        >
          {field.questionText}
        </Typography>
      )}
      <TextField
        fullWidth
        id={field.name}
        name={field.name}
        label={field.label}
        value={value}
        onChange={handleChange}
        error={!!error}
        helperText={error}
        required={field.required}
        FormHelperTextProps={{
          // @ts-ignore - Adding data-testid for testing purposes
          "data-testid": DATA_TEST_ID.STRING_FIELD_HELPER_TEXT,
        }}
        inputProps={{
          "data-testid": dataTestId || DATA_TEST_ID.STRING_FIELD_INPUT,
        }}
      />
    </Box>
  );
};

export default StringField;
