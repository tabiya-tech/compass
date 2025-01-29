import React from "react";
import { TextField, useTheme } from "@mui/material";

interface CommentTextFieldProps {
  placeholder?: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const uniqueId = "ab74a074-67f6-4a8a-b2b2-a582d1d56c9c";

export const DATA_TEST_ID = {
  COMMENT_TEXT_FIELD: `comment-text-field-${uniqueId}`,
};

const CommentTextField = React.forwardRef<HTMLInputElement, CommentTextFieldProps>(
  ({ placeholder, value, onChange }, ref) => {
    const theme = useTheme();

    return (
      <TextField
        placeholder={placeholder}
        multiline
        fullWidth
        rows={3}
        variant="outlined"
        value={value}
        onChange={onChange}
        inputRef={ref}
        inputProps={{ "data-testid": DATA_TEST_ID.COMMENT_TEXT_FIELD }}
        sx={{ marginTop: theme.fixedSpacing(theme.tabiyaSpacing.xs) }}
      />
    );
  }
);

export default CommentTextField;
