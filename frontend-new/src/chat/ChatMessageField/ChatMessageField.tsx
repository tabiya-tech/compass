import React, { useState } from "react";
import { IconButton, InputAdornment, TextField, styled, useTheme, Typography, Box, Popover } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

export interface ChatMessageFieldProps {
  message: string;
  notifyChange: React.Dispatch<React.SetStateAction<string>>;
  handleSend: () => void;
}

const uniqueId = "2a76494f-351d-409d-ba58-e1b2cfaf2a53";
export const DATA_TEST_ID = {
  CHAT_MESSAGE_FIELD_CONTAINER: `chat-message-field-container-${uniqueId}`,
  CHAT_MESSAGE_FIELD_SEND_BUTTON: `chat-message-field-send-button-${uniqueId}`,
  CHAT_MESSAGE_FIELD_SEND_ICON: `chat-message-field-send-icon-${uniqueId}`,
  CHAT_MESSAGE_CHAR_COUNTER: `chat-message-char-counter-${uniqueId}`,
  CHAT_MESSAGE_FIELD_EMOJI_BUTTON: `chat-message-field-emoji-button-${uniqueId}`,
  CHAT_MESSAGE_FIELD_EMOJI_ICON: `chat-message-field-emoji-icon-${uniqueId}`,
  CHAT_MESSAGE_FIELD_POPOVER: `chat-message-field-popover-${uniqueId}`,
  CHAT_MESSAGE_FIELD_EMOJI_PICKER: `chat-message-field-emoji-picker-${uniqueId}`,
};

export const CHAT_MESSAGE_MAX_LENGTH = 1000;
const DISALLOWED_CHARACTERS = /["\\{}()[\]*_#`<>\-+~|&/]/;

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
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null);

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
    if (DISALLOWED_CHARACTERS.test(inputValue)) {
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
      if (!errorMessage) {
        props.handleSend();
      }
    }
  };

  const handleEmojiClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setShowEmojiPicker(true);
    setAnchorEl(event.currentTarget);
  };

  const handleEmojiSelect = (emoji: any) => {
    if (props.notifyChange) {
      props.notifyChange(props.message + emoji.native);
    }
  };

  const open = Boolean(anchorEl);
  const id = open ? "simple-popover" : undefined;

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
                data-testid={DATA_TEST_ID.CHAT_MESSAGE_FIELD_EMOJI_BUTTON}
                aria-describedby={id}
                title="select emoji"
                onClick={handleEmojiClick}
              >
                <EmojiEmotionsIcon
                  data-testid={DATA_TEST_ID.CHAT_MESSAGE_FIELD_EMOJI_ICON}
                  sx={{
                    color: theme.palette.primary.dark,
                  }}
                />
              </IconButton>
              <IconButton
                data-testid={DATA_TEST_ID.CHAT_MESSAGE_FIELD_SEND_BUTTON}
                onClick={props.handleSend}
                title="send message"
                disabled={!!errorMessage}
              >
                <SendIcon
                  data-testid={DATA_TEST_ID.CHAT_MESSAGE_FIELD_SEND_ICON}
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
      {showEmojiPicker && (
        <Popover
          id={id}
          open={open}
          anchorEl={anchorEl}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{
            vertical: "top",
            horizontal: "center",
          }}
          transformOrigin={{
            vertical: "bottom",
            horizontal: "center",
          }}
          data-testid={DATA_TEST_ID.CHAT_MESSAGE_FIELD_POPOVER}
        >
          <Picker
            theme="light"
            data={data}
            onEmojiSelect={handleEmojiSelect}
            data-testid={DATA_TEST_ID.CHAT_MESSAGE_FIELD_EMOJI_PICKER}
          />
        </Popover>
      )}
    </Box>
  );
};

export default ChatMessageField;
