import React, {useEffect, useContext, useMemo, useState, MouseEvent} from "react";
import { IconButton, InputAdornment, TextField, styled, useTheme, Typography, Box } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { IsOnlineContext } from "src/app/providers/IsOnlineProvider";

export interface ChatMessageFieldProps {
  message: string;
  notifyChange: React.Dispatch<React.SetStateAction<string>>;
  handleSend: () => void;
  aiIsTyping: boolean;
  isChatFinished: boolean;
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

const StyledTextField = styled(TextField)(({ theme, disabled }) => ({
  "& .MuiOutlinedInput-root": {
    "& fieldset": {
      borderColor: theme.palette.primary.main,
      borderWidth: theme.fixedSpacing(theme.tabiyaSpacing.xxs),
    },
    "&:hover fieldset": {
      borderColor: !disabled ? theme.palette.primary.dark : theme.palette.grey[400],
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

    "&.Mui-disabled": {
      WebkitTextFillColor: theme.palette.text.textBlack,
    },
  },
}));

const ChatMessageField: React.FC<ChatMessageFieldProps> = (props) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const theme = useTheme();
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [charCount, setCharCount] = useState<number>(0);

  const isOnline = useContext(IsOnlineContext);

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

  const handleButtonClick = (e: MouseEvent) => {
    e.stopPropagation();

    // Prevent sending a message when the AI is typing, or a message is still being sent.
    if (props.aiIsTyping) return;

    // Prevent sending a message when the chat is finished.
    if (props?.isChatFinished) return;

    // Prevent sending an empty message
    if (!props.message.length) return;

    props.handleSend();
    setErrorMessage("");
    setCharCount(0);
  };

  // The character counter is only visible when the user types more than 75% of the character limit
  const showCharCounter = charCount > CHAT_MESSAGE_MAX_LENGTH * 0.75;
  // The character counter turns red when only 1% is left
  const counterColor =
    charCount >= CHAT_MESSAGE_MAX_LENGTH * 0.95 ? theme.palette.error.main : theme.palette.text.secondary;

  const placeHolder = useMemo(() => {
    if (props.isChatFinished) {
      return "Conversation has been completed. You can't send any more messages.";
    }
    if (props.aiIsTyping) {
      return "AI is typing..., wait for it to finish.";
    }
    if (!isOnline) {
      return "You are offline. Please connect to the internet to send a message.";
    }
    return "Type your message...";
  }, [props.aiIsTyping, props.isChatFinished, isOnline]);

  const isDisabled = props.isChatFinished || props.aiIsTyping;

  useEffect(() => {
    if(inputRef.current && !props.aiIsTyping) {
      inputRef.current.focus();
    }
  }, [props.aiIsTyping])

  // if the input is focused and the user scrolls, the input should be blurred
  useEffect(() => {
    const handleTouchEnd = () => {
      // if the input is focused, blur it
      if (document.activeElement === inputRef.current) {
        inputRef.current?.blur()
      }
    }
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

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
          placeholder={placeHolder}
          variant="outlined"
          fullWidth
          multiline
          maxRows={4}
          value={props.message}
          disabled={isDisabled}
          onChange={handleChange}
          inputRef={inputRef}
          error={!!errorMessage}
          helperText={errorMessage}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  data-testid={DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON}
                  onClick={handleButtonClick}
                  disabled={isDisabled || !isOnline}
                  color={"error"}
                  title="send message"
                >
                  <SendIcon
                    data-testid={DATA_TEST_ID.CHAT_MESSAGE_FIELD_ICON}
                    sx={{
                      color: (isDisabled || !isOnline) ? theme.palette.grey[400] : theme.palette.primary.dark,
                    }}
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
