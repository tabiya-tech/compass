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
  CHAT_MESSAGE_FIELD: `chat-message-field-${uniqueId}`,
  CHAT_MESSAGE_FIELD_BUTTON: `chat-message-field-button-${uniqueId}`,
  CHAT_MESSAGE_FIELD_ICON: `chat-message-field-icon-${uniqueId}`,
  CHAT_MESSAGE_CHAR_COUNTER: `chat-message-char-counter-${uniqueId}`,
};

export const CHAT_MESSAGE_MAX_LENGTH = 1000;
export const DISALLOWED_CHARACTERS = /["\\{}()[\]*_#`<>\-+~|&/]/g;

const StyledTextField = styled(TextField)(({ theme }) => ({
  "& .MuiOutlinedInput-root": {
    "& fieldset": {
      borderColor: theme.palette.primary.main,
      borderWidth: theme.fixedSpacing(theme.tabiyaSpacing.xxs),
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

    // Filter out disallowed characters
    let filteredValue = inputValue.replace(DISALLOWED_CHARACTERS, "");
    const invalidChar = inputValue.split("").filter((char) => DISALLOWED_CHARACTERS.test(char));

    // Update character count
    if (filteredValue) {
      setCharCount(filteredValue.length);
    }

    // Check for character limit
    if (filteredValue.length >= CHAT_MESSAGE_MAX_LENGTH) {
      errorMessage = "Message limit is 1000 characters.";
    }

    // Check for special characters in original input
    if (inputValue !== filteredValue) {
      errorMessage = `Invalid special characters: ${invalidChar}`;
    }

    setErrorMessage(errorMessage);

    if (props.notifyChange) {
      props.notifyChange(filteredValue);
    }
  };

  const handleButtonClick = () => {
    props.handleSend();
    setErrorMessage("");
    setCharCount(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleButtonClick();
    }
  };

  // The character counter is only visible when the user types more than 75% of the character limit
  const showCharCounter = charCount > CHAT_MESSAGE_MAX_LENGTH * 0.75;
  // The character counter turns red when only 1% is left
  const counterColor =
    charCount >= CHAT_MESSAGE_MAX_LENGTH * 0.95 ? theme.palette.error.main : theme.palette.text.secondary;

  return (
    <Box
      position="relative"
      data-testid={DATA_TEST_ID.CHAT_MESSAGE_FIELD_CONTAINER}
      sx={{
        width: "100%",
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          width: {
            xs: "100%",
            md: "60%",
          },
          position: "relative",
        }}
      >
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
                  onClick={handleButtonClick}
                  title="send message"
                >
                  <SendIcon
                    data-testid={DATA_TEST_ID.CHAT_MESSAGE_FIELD_ICON}
                    sx={{ color: theme.palette.primary.dark }}
                  />
                </IconButton>
              </InputAdornment>
            ),
            inputProps: {
              maxLength: 1000,
              "data-testid": DATA_TEST_ID.CHAT_MESSAGE_FIELD,
            },
          }}
        />
        {showCharCounter && (
          <Typography
            data-testid={DATA_TEST_ID.CHAT_MESSAGE_CHAR_COUNTER}
            variant="caption"
            color={counterColor}
            sx={{ position: "absolute", bottom: 0, right: 10 }}
          >
            {charCount}/{CHAT_MESSAGE_MAX_LENGTH}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default ChatMessageField;
