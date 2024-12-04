import React from "react";
import { TextField } from "@mui/material";

interface CommentTextFieldProps {
  placeholder?: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const uniqueId = "ab74a074-67f6-4a8a-b2b2-a582d1d56c9c";

export const DATA_TEST_ID = {
  COMMENT_TEXT_FIELD: `comment-text-field-${uniqueId}`,
}

const CommentTextField: React.FC<CommentTextFieldProps> = ({ placeholder, value, onChange }) => {
  return (
    <TextField
      placeholder={placeholder}
      multiline
      fullWidth
      rows={3}
      variant="outlined"
      value={value}
      onChange={onChange}
      inputProps={{ "data-testid": DATA_TEST_ID.COMMENT_TEXT_FIELD }}
    />
  );
};

export default CommentTextField;