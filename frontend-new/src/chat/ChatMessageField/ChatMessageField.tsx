import React, { useEffect, useContext, useMemo, useState, MouseEvent, KeyboardEvent, useCallback } from "react";
import { IconButton, InputAdornment, TextField, styled, useTheme, Typography, Box } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";

export interface ChatMessageFieldProps {
  handleSend: (message: string) => void;
  aiIsTyping: boolean;
  isChatFinished: boolean;
}

const uniqueId = "2a76494f-351d-409d-ba58-e1b2cfaf2a53";
export const CHAT_MESSAGE_MAX_LENGTH = 1000;
export const DISALLOWED_CHARACTERS = /["\\{}[\]*_#`<>~|]/g; // avoid special characters that could lead to a potential prompt injection

export const DATA_TEST_ID = {
  CHAT_MESSAGE_FIELD_CONTAINER: `chat-message-field-container-${uniqueId}`,
  CHAT_MESSAGE_FIELD: `chat-message-field-${uniqueId}`,
  CHAT_MESSAGE_FIELD_BUTTON: `chat-message-field-button-${uniqueId}`,
  CHAT_MESSAGE_FIELD_ICON: `chat-message-field-icon-${uniqueId}`,
  CHAT_MESSAGE_CHAR_COUNTER: `chat-message-char-counter-${uniqueId}`,
};
export const PLACEHOLDER_TEXTS = {
  CHAT_FINISHED: "Conversation has been completed. You can't send any more messages.",
  AI_TYPING: "AI is typing..., wait for it to finish.",
  OFFLINE: "You are offline. Please connect to the internet to send a message.",
  DEFAULT: "Type your message...",
};
export const ERROR_MESSAGES = {
  MESSAGE_LIMIT: `Message limit is ${CHAT_MESSAGE_MAX_LENGTH} characters.`,
  INVALID_SPECIAL_CHARACTERS: `Invalid special characters: `,
};

const StyledTextField = styled(TextField)(({ theme, disabled }) => ({
  "& .MuiOutlinedInput-root": {
    "& fieldset": {
      borderColor: theme.palette.primary.main,
      borderWidth: theme.fixedSpacing(theme.tabiyaSpacing.xxs),
    },
    "&:hover fieldset": {
      borderColor: disabled ? theme.palette.grey[400] : theme.palette.primary.dark,
    },
    "&.Mui-focused fieldset": {
      borderColor: theme.palette.primary.dark,
    },
    "&.Mui-error fieldset": {
      borderColor: theme.palette.error.main,
    },
  },

  // Change the color of the input text when disabled to make it more readable
  "& .MuiInputBase-input.MuiOutlinedInput-input.Mui-disabled": {
    WebkitTextFillColor: theme.palette.text.textBlack,
  },
}));

const ChatMessageField: React.FC<ChatMessageFieldProps> = (props) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const theme = useTheme();
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [message, setMessage] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const isOnline = useContext(IsOnlineContext);
  const [maxRows, setMaxRows] = useState(4);

  // Use effect to determine if the screen width is mobile and if the number of rows should be adjusted
  useEffect(() => {
    // Set the number of rows based on the initial screen height. Check the initial size and not on a resize,
    // as the height of the inner height will change when the keyboard is opened on mobile devices
    setMaxRows(window.innerHeight <= 600 ? 2 : window.innerHeight <= 900 ? 4 : 6);
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    // Initial check
    checkScreenSize();

    // Event listener for screen width changes
    window.addEventListener("resize", checkScreenSize);

    // Cleanup the event listener on component unmount
    return () => {
      window.removeEventListener("resize", checkScreenSize);
    };
  }, []);

  // Use effect to blur the input when the user scrolls
  useEffect(() => {
    // if the input is focused and the user scrolls, the input should be blurred
    const handleTouchEnd = () => {
      // if the input is focused, blur it
      if (document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    };
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  // Use effect bring the focus back to the input field when after a message from the AI is received
  useEffect(() => {
    if (inputRef.current && !props.aiIsTyping) {
      inputRef.current.focus();
    }
  }, [props.aiIsTyping, inputRef]);

  // Handle change in the input field and validate the message
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    let errorMessage = "";

    // Filter out disallowed characters
    let filteredValue = inputValue.replace(DISALLOWED_CHARACTERS, "");
    const invalidChar = inputValue.split("").filter((char) => DISALLOWED_CHARACTERS.test(char));

    // Check for character limit
    if (filteredValue.trim().length > CHAT_MESSAGE_MAX_LENGTH) {
      errorMessage = ERROR_MESSAGES.MESSAGE_LIMIT;
    }

    // Check for special characters in original input
    if (inputValue !== filteredValue) {
      errorMessage = `${ERROR_MESSAGES.INVALID_SPECIAL_CHARACTERS} ${invalidChar}`;
    }

    setErrorMessage(errorMessage);
    setMessage(filteredValue);
  };

  // Handle Enter key press to send message or add new line depending on the platform
  const handleKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLTextAreaElement;
    // prevent propagation if the Send button is focused
    if (target.tagName === "BUTTON") {
      event.stopPropagation();
      return;
    }

    if (event.key === "Enter") {
      if (isMobile || event.shiftKey) {
        // On mobile OR Shift+Enter, add a new line
        event.preventDefault();
        insertNewLineAtCaret(event);
      } else {
        // On desktop, Enter sends the message
        event.preventDefault();
        sendMessage();
      }
    }
  };

  const insertNewLineAtCaret = (event: KeyboardEvent) => {
    const textarea = event.target as HTMLTextAreaElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // Insert newline at caret position
    const newText = message.substring(0, start) + "\n" + message.substring(end);
    setMessage(newText);

    // Move caret to the right position after re-render
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + 1;
      // Ensure the TextField scrolls to the new caret position
      textarea.scrollTop = textarea.scrollHeight;
    }, 0);
  };

  const handleButtonClick = (e: MouseEvent) => {
    e.stopPropagation();
    sendMessage();
  };

  const sendMessage = () => {
    // Prevent sending a message when the user is offline.
    if (!isOnline) {
      return;
    }

    // Prevent sending a message when the AI is typing, or a message is still being sent.
    if (props.aiIsTyping) {
      return;
    }

    // Prevent sending a message when the chat is finished.
    if (props?.isChatFinished) {
      return;
    }

    // Trim the message and send it
    const trimmedMessage = message?.trim() || "";
    if (trimmedMessage.length !== 0) {
      props.handleSend(trimmedMessage);
      setMessage("");
      setErrorMessage("");
    }
  };

  // The character counter is only visible when the user types more than 75% of the character limit
  const showCharCounter = message.trim().length > CHAT_MESSAGE_MAX_LENGTH * 0.75;

  // The character counter turns to warning and then error when the user types more than 75% and 100% of the character limit respectively
  const counterColor = useCallback(() => {
    if (message.trim().length > CHAT_MESSAGE_MAX_LENGTH) {
      return theme.palette.error.main;
    } else if (message.trim().length >= CHAT_MESSAGE_MAX_LENGTH * 0.75) {
      return theme.palette.warning.main;
    }
    return theme.palette.text.secondary;
  }, [message, theme.palette.error.main, theme.palette.warning.main, theme.palette.text.secondary]);

  // Placeholder text based on the chat status
  const placeHolder = useMemo(() => {
    if (props.isChatFinished) {
      return PLACEHOLDER_TEXTS.CHAT_FINISHED;
    }
    if (props.aiIsTyping) {
      return PLACEHOLDER_TEXTS.AI_TYPING;
    }
    if (!isOnline) {
      return PLACEHOLDER_TEXTS.OFFLINE;
    }
    return PLACEHOLDER_TEXTS.DEFAULT;
  }, [props.aiIsTyping, props.isChatFinished, isOnline]);

  // Check if the send button should be disabled
  const sendIsDisabled = useCallback(() => {
    return (
      props.isChatFinished ||
      props.aiIsTyping ||
      !isOnline ||
      message.trim().length === 0 ||
      message.trim().length > CHAT_MESSAGE_MAX_LENGTH
    );
  }, [props.isChatFinished, props.aiIsTyping, isOnline, message]);

  // Check if the input field should be disabled
  const inputIsDisabled = useCallback(() => {
    return props.isChatFinished || props.aiIsTyping || !isOnline;
  }, [props.isChatFinished, props.aiIsTyping, isOnline]);

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
          // responsive padding

          width: {
            xs: "100%",
            md: "60%",
          },
          position: "relative",
        }}
      >
        <StyledTextField
          placeholder={placeHolder}
          variant="outlined"
          fullWidth
          multiline
          maxRows={maxRows}
          value={message}
          disabled={inputIsDisabled()}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          inputRef={inputRef}
          error={!!errorMessage}
          helperText={errorMessage}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  data-testid={DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON}
                  onClick={handleButtonClick}
                  onKeyDown={(event) => event.stopPropagation()}
                  disabled={sendIsDisabled()}
                  title="send message"
                >
                  <SendIcon
                    data-testid={DATA_TEST_ID.CHAT_MESSAGE_FIELD_ICON}
                    sx={{
                      color: sendIsDisabled() ? theme.palette.grey[400] : theme.palette.primary.dark,
                    }}
                  />
                </IconButton>
              </InputAdornment>
            ),
            inputProps: {
              maxLength: CHAT_MESSAGE_MAX_LENGTH * 1.1, // Add 10% extra space for the text that can be entered in the input field
              "data-testid": DATA_TEST_ID.CHAT_MESSAGE_FIELD,
            },
          }}
        />
        {showCharCounter && (
          <Typography
            data-testid={DATA_TEST_ID.CHAT_MESSAGE_CHAR_COUNTER}
            variant="caption"
            color={counterColor()}
            sx={{ position: "absolute", bottom: 0, right: 10 }}
          >
            {message.trim().length}/{CHAT_MESSAGE_MAX_LENGTH}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default ChatMessageField;
