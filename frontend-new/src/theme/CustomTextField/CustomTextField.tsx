import React from "react";
import { styled } from "@mui/system";
import { Box, TextField, Typography } from "@mui/material";

interface CustomTextFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const uniqueId = "f4b3b3b3-4b3b-4b3b-4b3b-4b3b4b3b4b3b";

export const DATA_TEST_ID = {
  CUSTOM_TEXT_FIELD_CONTAINER: `custom-text-field-container-${uniqueId}`,
  CUSTOM_TEXT_FIELD_LABEL: `custom-text-field-label-${uniqueId}`,
  CUSTOM_TEXT_FIELD_INPUT: `custom-text-field-input-${uniqueId}`,
};

const CustomTextFieldStyle = styled(TextField)({
  "& .MuiOutlinedInput-root": {
    "& fieldset": {
      border: "none",
    },
    "&:hover fieldset": {
      border: "none",
    },
    "&.Mui-focused fieldset": {
      border: "none",
    },
  },
  "& .MuiInputBase-root": {
    border: "none",
    fontSize: "inherit",
  },
  "& .MuiInputBase-input": {
    padding: 0,
    background: "transparent !important",
  },
});

const CustomTextField: React.FC<CustomTextFieldProps> = ({ label, placeholder, value, onChange }) => {
  return (
    <Box display="flex" gap={1} alignItems="center" data-testid={DATA_TEST_ID.CUSTOM_TEXT_FIELD_CONTAINER}>
      <Typography variant="body1" fontWeight="bold" data-testid={DATA_TEST_ID.CUSTOM_TEXT_FIELD_LABEL}>
        {label}
      </Typography>
      <CustomTextFieldStyle
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        data-testid={DATA_TEST_ID.CUSTOM_TEXT_FIELD_INPUT}
      />
    </Box>
  );
};

export default CustomTextField;
