import React, { useState, useCallback } from "react";
import { 
  FormControl, 
  InputLabel, 
  MenuItem, 
  Select, 
  FormHelperText, 
  SelectChangeEvent,
  IconButton,
  Typography,
  Box
} from "@mui/material";
import ClearIcon from '@mui/icons-material/Clear';
import { EnumFieldDefinition } from "src/sensitiveData/components/sensitiveDataForm/config/types";

const uniqueId = "5dae7bed-8fbc-455e-8d3b-0bebd7c72749";

export const DATA_TEST_ID = {
  ENUM_FIELD_WRAPPER: `enum-field-wrapper-${uniqueId}`,
  ENUM_FIELD_SELECT: `enum-field-select-${uniqueId}`,
  ENUM_FIELD_INPUT_LABEL: `enum-field-input-label-${uniqueId}`,
  ENUM_FIELD_FORM_HELPER_TEXT: `enum-field-form-helper-text-${uniqueId}`,
  ENUM_FIELD_CLEAR_BUTTON: `enum-field-clear-button-${uniqueId}`,
  ENUM_FIELD_QUESTION_TEXT: `enum-field-question-text-${uniqueId}`,
  ENUM_FIELD_FORM_CONTROL: `enum-field-form-control-${uniqueId}`,
  ENUM_FIELD_MENU_ITEM: `enum-field-menu-item-${uniqueId}`,
  ENUM_FIELD_EMPTY_OPTION: `enum-field-empty-option-${uniqueId}`,
}

interface EnumFieldProps {
  field: EnumFieldDefinition;
  dataTestId: string;
  initialValue?: string;
  onChange: (value: string, isValid: boolean) => void;
}

/**
 * Component for rendering dropdown/select fields with single selection
 */
const EnumField: React.FC<EnumFieldProps> = ({ field, dataTestId, initialValue = "", onChange }) => {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  // Simple validation function
  const validate = useCallback((selectedValue: string): { isValid: boolean; errorMessage: string | null } => {
    // If required and empty, it's invalid
    if (field.required && (!selectedValue || selectedValue === '')) {
      return { 
        isValid: false, 
        errorMessage: `Please select a ${field.label.toLowerCase()}`
      };
    }
    
    return { isValid: true, errorMessage: null };
  }, [field.label, field.required]);

  // Handle selection change
  const handleChange = (event: SelectChangeEvent<string>) => {
    const inputValue = event.target.value;
    setValue(inputValue);

    // If the input value is "prefer_not_to_say", set it to an empty string
    const newValue = inputValue === "prefer_not_to_say" ? "" : inputValue;

    // Validate and notify parent
    const { isValid, errorMessage } = validate(newValue);
    setError(errorMessage);
    onChange(newValue, isValid);
  };
  
  // Handle clearing the selection
  const handleClear = () => {
    setValue('');
    
    // For non-required fields, empty is valid
    setError(null);
    onChange('', true);
  };

  return (
    <Box 
      display="flex" 
      flexDirection="column" 
      gap={theme => theme.fixedSpacing(theme.tabiyaSpacing.xs)}
      data-testid={DATA_TEST_ID.ENUM_FIELD_WRAPPER}
    >
      {field.questionText && (
        <Typography 
          variant="caption" 
          color="text.secondary"
          data-testid={DATA_TEST_ID.ENUM_FIELD_QUESTION_TEXT}
          sx={{ 
            display: 'block',
            lineHeight: 1.5,
            mb: 0.5,
            fontSize: '0.7rem'
          }}
        >
          {field.questionText}
        </Typography>
      )}
      <FormControl 
        fullWidth 
        error={!!error}
        data-testid={DATA_TEST_ID.ENUM_FIELD_FORM_CONTROL}
      >
        <InputLabel 
          required={field.required} 
          sx={{fontFamily:theme=> theme.typography.caption.fontFamily}} 
          id={`${field.name}-select-label`}
          data-testid={DATA_TEST_ID.ENUM_FIELD_INPUT_LABEL}
        >
          {field.label}
        </InputLabel>
        <Select
          value={value}
          labelId={`${field.name}-select-label`}
          id={`${field.name}-select`}
          label={field.label}
          data-testid={DATA_TEST_ID.ENUM_FIELD_SELECT}
          onChange={handleChange}
          endAdornment={
            !field.required && value !== '' && (
              <IconButton 
                size="small" 
                sx={{ marginRight: 2 }}
                onClick={handleClear}
                aria-label="clear selection"
                data-testid={DATA_TEST_ID.ENUM_FIELD_CLEAR_BUTTON}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            )
          }
        >
          {!field.required && (
            <MenuItem value="prefer_not_to_say" data-testid={DATA_TEST_ID.ENUM_FIELD_EMPTY_OPTION}>
              Prefer not to say
            </MenuItem>
          )}
          {field.values.map((value, index) => (
            <MenuItem
              key={`${field.dataKey}-${index}`}
              data-testid={`${DATA_TEST_ID.ENUM_FIELD_MENU_ITEM}-${index}`}
              value={value}
            >
              {value}
            </MenuItem>
          ))}
        </Select>
        {error && (
          <FormHelperText 
            data-testid={DATA_TEST_ID.ENUM_FIELD_FORM_HELPER_TEXT}
          >
            {error}
          </FormHelperText>
        )}
      </FormControl>
    </Box>
  );
};

export default EnumField; 