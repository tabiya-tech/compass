import React, { useState } from "react";
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  FormHelperText,
  Chip,
  Box,
  OutlinedInput,
  Typography,
  ListSubheader,
  TextField,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useTranslation } from "react-i18next";

const SEARCHABLE_THRESHOLD = 5;
import { MultipleSelectFieldDefinition } from "src/sensitiveData/components/sensitiveDataForm/config/types";

export const DATA_TEST_ID = {
  MULTIPLE_SELECT_FIELD: "multiple-select-field",
  MULTIPLE_SELECT_FIELD_QUESTION_TEXT: "multiple-select-field-question-text",
  MULTIPLE_SELECT_FIELD_FORM_CONTROL: "multiple-select-field-form-control",
  MULTIPLE_SELECT_FIELD_INPUT_LABEL: "multiple-select-field-input-label",
  MULTIPLE_SELECT_FIELD_SELECT: "multiple-select-field-select",
  MULTIPLE_SELECT_FIELD_MENU_ITEM: "multiple-select-field-menu-item",
  MULTIPLE_SELECT_FIELD_CHIP: "multiple-select-field-chip",
  MULTIPLE_SELECT_FIELD_HELPER_TEXT: "multiple-select-field-helper-text",
};

interface MultipleFieldProps {
  field: MultipleSelectFieldDefinition;
  dataTestId: string;
  initialValue?: string[];
  onChange: (values: string[], isValid: boolean) => void;
}

/**
 * Component for rendering dropdown/select fields with multiple selection
 */
const MultipleSelectField: React.FC<MultipleFieldProps> = ({ field, dataTestId, initialValue = [], onChange }) => {
  const { t } = useTranslation();
  const [selectedValues, setSelectedValues] = useState<string[]>(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const isSearchable = field.values.length > SEARCHABLE_THRESHOLD;
  const visibleValues = isSearchable
    ? field.values.filter((v) => v.toLowerCase().includes(searchQuery.toLowerCase()))
    : field.values;

  // Simple validation function
  const validate = (values: string[]): { isValid: boolean; errorMessage: string | null } => {
    // If required and empty, it's invalid
    if (field.required && (!values || values.length === 0)) {
      return {
        isValid: false,
        errorMessage: t("sensitiveData.components.multipleSelectField.selectAtLeastOne", {
          field: field.label.toLowerCase(),
        }),
      };
    }

    return { isValid: true, errorMessage: null };
  };

  // Handle selection change
  const handleChange = (event: SelectChangeEvent<string[]>) => {
    const newValues = event.target.value as string[];
    setSelectedValues(newValues);

    // Validate and notify parent
    const { isValid, errorMessage } = validate(newValues);
    setError(errorMessage);
    onChange(newValues, isValid);
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      gap={(theme) => theme.fixedSpacing(theme.tabiyaRounding.xs)}
      data-testid={DATA_TEST_ID.MULTIPLE_SELECT_FIELD}
    >
      {field.questionText && (
        <Typography
          variant="caption"
          color="text.secondary"
          data-testid={DATA_TEST_ID.MULTIPLE_SELECT_FIELD_QUESTION_TEXT}
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
      <FormControl fullWidth error={!!error} data-testid={DATA_TEST_ID.MULTIPLE_SELECT_FIELD_FORM_CONTROL}>
        <InputLabel
          required={field.required}
          id={`${field.name}-select-label`}
          data-testid={DATA_TEST_ID.MULTIPLE_SELECT_FIELD_INPUT_LABEL}
        >
          {field.label}
        </InputLabel>
        <Select
          multiple
          value={selectedValues}
          labelId={`${field.name}-select-label`}
          id={`${field.name}-select`}
          label={field.label}
          data-testid={dataTestId || DATA_TEST_ID.MULTIPLE_SELECT_FIELD_SELECT}
          input={<OutlinedInput label={field.label} />}
          onChange={handleChange}
          onClose={() => setSearchQuery("")}
          renderValue={(selected) => (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {selected.map((value) => (
                <Chip
                  key={value}
                  label={value}
                  size="small"
                  data-testid={`${DATA_TEST_ID.MULTIPLE_SELECT_FIELD_CHIP}-${value}`}
                />
              ))}
            </Box>
          )}
        >
          {isSearchable && (
            <ListSubheader sx={{ pt: 1, pb: 0.5, lineHeight: "normal", bgcolor: "background.paper" }}>
              <TextField
                size="small"
                autoFocus
                placeholder={t("sensitiveData.components.multipleSelectField.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                slotProps={{
                  input: { startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, color: "text.disabled" }} /> },
                  htmlInput: { "aria-label": t("sensitiveData.components.multipleSelectField.searchAriaLabel") },
                }}
                sx={{ width: "100%" }}
              />
            </ListSubheader>
          )}
          {visibleValues.map((value, index) => (
            <MenuItem
              key={`${field.dataKey}-${index}`}
              data-testid={`${DATA_TEST_ID.MULTIPLE_SELECT_FIELD_MENU_ITEM}-${index}`}
              value={value}
              data-value={value}
            >
              {value}
            </MenuItem>
          ))}
        </Select>
        {error && <FormHelperText data-testid={DATA_TEST_ID.MULTIPLE_SELECT_FIELD_HELPER_TEXT}>{error}</FormHelperText>}
      </FormControl>
    </Box>
  );
};

export default MultipleSelectField;
