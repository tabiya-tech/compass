import React, { useState } from "react";
import { IconButton, InputAdornment, TextField, styled, useTheme, Typography, Box } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";

export interface ChatMessageFieldProps {
  message: string;
  notifyChange: React.Dispatch<React.SetStateAction<string>>;
  handleSend: () => void;
}

const uniqueId = "2a76494f-351d-409d-ba58-e1b2cfaf2a53";
export const DATA_TEST_ID = {
  CHAT_MESSAGE_FIELD_CONTAINER: `chat-message-field-container-${uniqueId}`,
  CHAT_MESSAGE_FIELD_BUTTON: `chat-message-field-button-${uniqueId}`,
  CHAT_MESSAGE_FIELD_ICON: `chat-message-field-icon-${uniqueId}`,
  CHAT_MESSAGE_CHAR_COUNTER: `chat-message-char-counter-${uniqueId}`
};

export const CHAT_MESSAGE_MAX_LENGTH = 1000;
export const ALLOWED_CHARACTERS = /^[A-Za-z0-9 .,:;!?@'\n]*$/;

const StyledTextField = styled(TextField)(({ theme }) => ({
  "& .MuiOutlinedInput-root": {
    "& fieldset": {
      borderColor: theme.palette.primary.main,
      borderWidth: "2px",
    },
    "&:hover fieldset": {
      borderColor: theme.palette.primary.dark,
    },
    "&.Mui-focused fieldset": {
      borderColor: theme.palette.primary.dark,
    },
    "&.Mui-error fieldset": {
      borderColor: theme.palette.error.main,
    },
  },
  "& .css-111mkcg-MuiInputBase-input-MuiOutlinedInput-input": {
    paddingRight: theme.spacing(4),
  },
}));

const ChatMessageField: React.FC<ChatMessageFieldProps> = (props) => {
  const theme = useTheme();
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [charCount, setCharCount] = useState<number>(0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    let errorMessage = "";

    // Update character count
    if (inputValue) {
      setCharCount(inputValue.length);
    }

    // Check for character limit
    if (inputValue.length >= CHAT_MESSAGE_MAX_LENGTH) {
      errorMessage = "Message limit is 1000 characters.";
    }

    // Check for special characters
    if (!ALLOWED_CHARACTERS.test(inputValue)) {
      errorMessage = "Invalid special characters.";
    }

    setErrorMessage(errorMessage);

    if (props.notifyChange) {
      props.notifyChange(inputValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      props.handleSend();
    }
  };

  // The character counter is only visible when the user types more than 75% of the character limit
  const showCharCounter = charCount > CHAT_MESSAGE_MAX_LENGTH * 0.75;
  // The character counter turns red when only 1% is left
  const counterColor =
    charCount >= CHAT_MESSAGE_MAX_LENGTH * 0.95 ? theme.palette.error.main : theme.palette.text.secondary;

  return (
    <Box position="relative">
      <StyledTextField
        placeholder="Type your message..."
        variant="outlined"
        fullWidth
        multiline
        maxRows={4}
        value={props.message}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        error={!!errorMessage}
        helperText={errorMessage}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                data-testid={DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON}
                onClick={props.handleSend}
                title="send message"
                disabled={!!errorMessage}
              >
                <SendIcon
                  data-testid={DATA_TEST_ID.CHAT_MESSAGE_FIELD_ICON}
                  sx={{
                    color: errorMessage ? theme.palette.action.disabled : theme.palette.primary.dark,
                  }}
                />
              </IconButton>
            </InputAdornment>
          ),
          inputProps: {
            maxLength: 1000,
            "data-testid": DATA_TEST_ID.CHAT_MESSAGE_FIELD_CONTAINER,
          },
        }}
      />
      {showCharCounter && (
        <Typography
          data-testid={DATA_TEST_ID.CHAT_MESSAGE_CHAR_COUNTER}
          variant="caption"
          color={counterColor}
          sx={{ position: "absolute", bottom: -20, right: 10 }}
        >
          {charCount}/{CHAT_MESSAGE_MAX_LENGTH}
        </Typography>
      )}
    </Box>
  );
};

export default ChatMessageField;
