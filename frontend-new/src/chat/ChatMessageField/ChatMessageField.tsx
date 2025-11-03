import React, { useEffect, useContext, useMemo, useState, MouseEvent, KeyboardEvent, useCallback } from "react";
import { IconButton, InputAdornment, TextField, styled, useTheme, Typography, Box } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AddIcon from "@mui/icons-material/Add";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { AnimatePresence, motion } from "framer-motion";
import { CV_UPLOAD_ERROR_MESSAGES, getCvUploadErrorMessageFromHttpStatus } from "../CVUploadErrorHandling";
import ContextMenu from "src/theme/ContextMenu/ContextMenu";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { ConversationPhase } from "src/chat/chatProgressbar/types";
import AnimatedDotBadge from "src/theme/AnimatedDotBadge/AnimatedDotBadge";
import { getCvUploadEnabled } from "src/envService";
import CVService from "src/CV/CVService/CVService";
import { CVListItem } from "src/CV/CVService/CVService.types";
import authenticationStateService from "src/auth/services/AuthenticationState.service";
import { ChatError } from "src/error/commonErrors";
import { formatExperiencesToMessage } from "src/chat/util";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import UploadedCVsMenu from "src/CV/uploadedCVsMenu/UploadedCVsMenu";
import { useTranslation } from "react-i18next";

export interface ChatMessageFieldProps {
  handleSend: (message: string) => void;
  aiIsTyping: boolean;
  isChatFinished: boolean;
  isUploadingCv?: boolean;
  onUploadCv?: (file: File) => Promise<string[]>; // returns array of experience lines
  currentPhase?: ConversationPhase;
  prefillMessage?: string | null; // optional prefill content for the input field
  cvUploadError?: string | null; // CV upload error message from polling process
}

const uniqueId = "2a76494f-351d-409d-ba58-e1b2cfaf2a53";
export const CHAT_MESSAGE_MAX_LENGTH = 1000;
export const DISALLOWED_CHARACTERS = /["\\{}[\]*_#`<>~|]/g; // avoid special characters that could lead to a potential prompt injection
export const MAX_MARKDOWN_CHARS = 5000; // Maximum number of Markdown characters allowed

export const DATA_TEST_ID = {
  CHAT_MESSAGE_FIELD_CONTAINER: `chat-message-field-container-${uniqueId}`,
  CHAT_MESSAGE_FIELD: `chat-message-field-${uniqueId}`,
  CHAT_MESSAGE_FIELD_SEND_BUTTON: `chat-message-field-send-button-${uniqueId}`,
  CHAT_MESSAGE_FIELD_SEND_ICON: `chat-message-field-send-icon-${uniqueId}`,
  CHAT_MESSAGE_CHAR_COUNTER: `chat-message-char-counter-${uniqueId}`,
  CHAT_MESSAGE_FIELD_PLUS_BUTTON: `chat-message-field-plus-button-${uniqueId}`,
  CHAT_MESSAGE_FIELD_PLUS_ICON: `chat-message-field-plus-icon-${uniqueId}`,
  CHAT_MESSAGE_FIELD_HIDDEN_FILE_INPUT: `chat-message-field-hidden-file-input-${uniqueId}`,
};

export const MENU_ITEM_ID = {
  UPLOAD_CV: `upload-cv-${uniqueId}`,
  UPLOADED_CV_ACCORDION: `uploaded-cv-accordion-${uniqueId}`,
  VIEW_UPLOADED_CVS: `view-uploaded-cvs-${uniqueId}`,
  CV_LIST_HEADER: `cv-list-header-${uniqueId}`,
};

export const MENU_ITEM_TEXT = {
  UPLOAD_CV: "upload_cv_upload_label",
  UPLOADED_CV_ACCORDION: "upload_cv_view_uploaded_label",
  VIEW_UPLOADED_CVS: "upload_cv_view_uploaded_label",
};

export const PLACEHOLDER_TEXTS = {
  CHAT_FINISHED: "chat_finished",
  AI_TYPING: "ai_typing",
  OFFLINE: "offline",
  DEFAULT: "default",
  UPLOADING: "uploading",
};
export const CHARACTER_LIMIT_ERROR_MESSAGES = {
  MESSAGE_LIMIT: "chat_message_error_limit",
  INVALID_SPECIAL_CHARACTERS: "chat_message_error_invalid_chars",
  MAX_FILE_SIZE: "chat_message_cv_error_max_file_size",
  FILE_TOO_DENSE: "chat_message_cv_error_too_dense",
  EMPTY_CV_PARSE: "chat_message_cv_error_empty_parse",
  GENERIC_UPLOAD_ERROR: "chat_message_cv_error_generic",
  RATE_LIMIT_WAIT: "chat_message_cv_error_rate_limit",
  MAX_UPLOADS_REACHED: "chat_message_cv_error_max_uploads_reached",
  DUPLICATE_CV: "chat_message_cv_error_duplicate",
  UNSUPPORTED_FILE_TYPE: "chat_message_cv_error_unsupported_file_type",
  UPLOAD_TIMEOUT: "chat_message_cv_error_timeout",
};

// Define the max file size in bytes 3 MB
export const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024;
export const MAX_FILE_SIZE_MB = MAX_FILE_SIZE_BYTES / (1024 * 1024);

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
  const { t } = useTranslation();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const theme = useTheme();
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [message, setMessage] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const isOnline = useContext(IsOnlineContext);
  const [maxRows, setMaxRows] = useState(4);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const isMenuOpen = Boolean(menuAnchorEl);
  const [showPlusBadge, setShowPlusBadge] = useState(false);
  const [badgeSeen, setBadgeSeen] = useState<boolean>(false);
  const [uploadedCVs, setUploadedCVs] = useState<CVListItem[]>([]);
  const [isLoadingCVs, setIsLoadingCVs] = useState(false);
  const [menuView, setMenuView] = useState<"main" | "cvList">("main");

  const isCvUploadEnabled = getCvUploadEnabled().toLowerCase() === "true";

  // Show the dot badge whenever in COLLECT_EXPERIENCES and not yet seen
  useEffect(() => {
    const shouldShow = props.currentPhase === ConversationPhase.COLLECT_EXPERIENCES && !badgeSeen && !isMenuOpen;
    setShowPlusBadge(shouldShow);
  }, [props.currentPhase, badgeSeen, isMenuOpen]);

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
    const inputElement = e.target;
    const inputValue = e.target.value;
    let errorMessage = "";

    // Save caret position before changes, if it is null, use the end of the input value.
    const previousCaretPosition = inputElement.selectionStart ?? inputValue.length;

    // Filter out disallowed characters
    let filteredValue = inputValue.replace(DISALLOWED_CHARACTERS, "");
    const invalidChar = inputValue.split("").filter((char) => DISALLOWED_CHARACTERS.test(char));

    // Check for character limit - truncate if over limit but allow deletion
    if (filteredValue.trim().length > CHAT_MESSAGE_MAX_LENGTH) {
      errorMessage = t(CHARACTER_LIMIT_ERROR_MESSAGES.MESSAGE_LIMIT, { max: CHAT_MESSAGE_MAX_LENGTH });
      // Only truncate if the user is adding characters (not deleting)
      // This allows deletion when over the limit
      const currentMessageLength = message.trim().length;
      const newValueLength = filteredValue.trim().length;

      // If the new value is longer than the current message, user is adding characters
      // If the new value is shorter than the current message, user is deleting characters
      if (newValueLength > currentMessageLength) {
        // User is adding characters, reject the change by keeping current message
        filteredValue = message;
      }
      // If user is deleting characters, allow it by keeping the filteredValue as is
    } else if (inputValue !== filteredValue) {
      // Check for special characters in original input
      const chars = invalidChar.join(",");
      errorMessage = t(CHARACTER_LIMIT_ERROR_MESSAGES.INVALID_SPECIAL_CHARACTERS, { chars });
    }

    setErrorMessage(errorMessage);

    // Manually update input to keep caret position
    inputElement.value = filteredValue;
    // restore the message to the filtered value without invalid characters
    setMessage(filteredValue);

    // Restore caret position after removing characters
    const removedChars = inputValue.length - filteredValue.length;
    // if the user has added new characters, the caret position should be moved to the right with the same count.
    const newCaretPosition = previousCaretPosition - removedChars;
    // Restore the caret position to the new caret position
    inputElement.setSelectionRange(newCaretPosition, newCaretPosition);
  };

  // Prefill message when provided from the parent (e.g., after CV processing completes)
  useEffect(() => {
    if (!props.prefillMessage) return;
    setMessage(props.prefillMessage);

    // Set appropriate error message if prefill exceeds limit
    if (props.prefillMessage.trim().length > CHAT_MESSAGE_MAX_LENGTH) {
      // Translate with interpolation to avoid rendering un-interpolated placeholders
      setErrorMessage(t(CHARACTER_LIMIT_ERROR_MESSAGES.MESSAGE_LIMIT, { max: CHAT_MESSAGE_MAX_LENGTH }));
    } else {
      setErrorMessage("");
    }
  }, [props.prefillMessage, t]);

  // Handle CV upload errors from polling process
  useEffect(() => {
    if (props.cvUploadError) {
      setErrorMessage(props.cvUploadError);
    } else if (props.cvUploadError === null) {
      // Clear error message when cvUploadError is explicitly set to null
      setErrorMessage("");
    }
  }, [props.cvUploadError]);

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
        if (sendIsDisabled()) return;
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

  const handlePlusClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (inputIsDisabled()) return;
    setMenuAnchorEl(e.currentTarget);
    setMenuView("main");
    setShowPlusBadge(false);
    if (!badgeSeen) setBadgeSeen(true);
  };

  const handleViewUploadedCVs = async () => {
    setIsLoadingCVs(true);
    setMenuView("cvList");
    try {
      const currentUserId = authenticationStateService.getInstance().getUser()?.id;
      if (!currentUserId) throw new ChatError("User ID is not available");
      const cvs = await CVService.getInstance().getAllCVs(currentUserId);
      setUploadedCVs(cvs);
    } catch (err) {
      console.error("Failed to fetch CVs:", err);
    } finally {
      setIsLoadingCVs(false);
    }
  };

  const handleMenuClose = () => setMenuAnchorEl(null);

  const handleSelectCV = (cv: CVListItem) => {
    const composed = formatExperiencesToMessage(cv.experiences_data);
    setMessage(composed);
    setMenuAnchorEl(null);
    if (composed.trim().length > CHAT_MESSAGE_MAX_LENGTH) {
      // Translate with interpolation to avoid rendering un-interpolated placeholders
      setErrorMessage(t(CHARACTER_LIMIT_ERROR_MESSAGES.MESSAGE_LIMIT, { max: CHAT_MESSAGE_MAX_LENGTH }));
    }
  };

  const handleFileMenuItemClick = () => {
    handleMenuClose();
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    // Reset the input, so selecting the same file again will trigger onChange
    e.target.value = "";

    // Clear any previous inline errors from past attempts
    if (errorMessage) {
      setErrorMessage("");
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(CV_UPLOAD_ERROR_MESSAGES.MAX_FILE_SIZE);
      return;
    }

    // Clear size error specifically if previously set
    if (errorMessage === CV_UPLOAD_ERROR_MESSAGES.MAX_FILE_SIZE) {
      setErrorMessage("");
    }

    if (!props.onUploadCv) return;
    try {
      const experiences = await props.onUploadCv(file);
      // With the asynchronous upload pipeline, the initial response may be empty (200 with background processing).
      // Do not treat an empty experiences array as an error. Only compose the message when we actually receive items.
      if (Array.isArray(experiences) && experiences.length > 0) {
        const composed = formatExperiencesToMessage(experiences);
        setMessage(composed);
        // Ensure any previous error is cleared on success
        if (errorMessage) {
          setErrorMessage("");
        }
      }
    } catch (err: any) {
      console.error("Error parsing CV file:", err);
      const status = err?.statusCode || err?.status || err?.response?.status;
      const detail = err?.response?.data?.detail;
      // Use centralized error message mapping
      const errorMessage = getCvUploadErrorMessageFromHttpStatus(status, detail);
      setErrorMessage(errorMessage);
    }
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
      return t(PLACEHOLDER_TEXTS.CHAT_FINISHED);
    }
    if (props.isUploadingCv) {
      return t(PLACEHOLDER_TEXTS.UPLOADING);
    }
    if (props.aiIsTyping) {
      return t(PLACEHOLDER_TEXTS.AI_TYPING);
    }
    if (!isOnline) {
      return t(PLACEHOLDER_TEXTS.OFFLINE);
    }
    return t(PLACEHOLDER_TEXTS.DEFAULT);
  }, [props.aiIsTyping, props.isChatFinished, props.isUploadingCv, isOnline, t]);

  // Check if the send button should be disabled
  const sendIsDisabled = useCallback(() => {
    return (
      props.isChatFinished ||
      props.aiIsTyping ||
      props.isUploadingCv ||
      !isOnline ||
      message.trim().length === 0 ||
      message.trim().length > CHAT_MESSAGE_MAX_LENGTH // Only disable the send button when over the limit
    );
  }, [props.isChatFinished, props.aiIsTyping, props.isUploadingCv, isOnline, message]);

  // Check if the input field should be disabled
  const inputIsDisabled = useCallback(() => {
    return props.isChatFinished || props.aiIsTyping || props.isUploadingCv || !isOnline;
  }, [props.isChatFinished, props.aiIsTyping, props.isUploadingCv, isOnline]);

  const contextMenuItems: MenuItemConfig[] =
    menuView === "main"
      ? [
          {
            id: MENU_ITEM_ID.VIEW_UPLOADED_CVS,
            text: t(MENU_ITEM_TEXT.VIEW_UPLOADED_CVS),
            icon: <DescriptionOutlinedIcon />,
            trailingIcon: <ChevronRightIcon />,
            description: t("upload_cv_view_uploaded_description"),
            disabled: inputIsDisabled(),
            action: () => {
              void handleViewUploadedCVs();
            },
            closeMenuOnClick: false,
          },
          {
            id: MENU_ITEM_ID.UPLOAD_CV,
            text: t(MENU_ITEM_TEXT.UPLOAD_CV),
            description:
              props.currentPhase === ConversationPhase.INTRO
                ? t("upload_cv_intro")
                : props.currentPhase === ConversationPhase.COLLECT_EXPERIENCES
                  ? t("upload_cv_collect_experiences")
                  : t("upload_cv_other_phase"),
            icon: <UploadFileIcon />,
            disabled: inputIsDisabled() || props.currentPhase !== ConversationPhase.COLLECT_EXPERIENCES,
            action: handleFileMenuItemClick,
          },
        ]
      : [
          {
            id: MENU_ITEM_ID.CV_LIST_HEADER,
            text: "",
            disabled: false,
            action: () => {},
            customNode: (
              <UploadedCVsMenu
                currentPhase={props.currentPhase}
                onBack={() => setMenuView("main")}
                onSelect={handleSelectCV}
                isLoading={isLoadingCVs}
                uploadedCVs={uploadedCVs}
              />
            ),
          },
        ];

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
          helperText={errorMessage ? t(errorMessage) : ""}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <AnimatePresence initial={false}>
                  {message.trim().length === 0 && !inputIsDisabled() && isCvUploadEnabled && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <IconButton
                        aria-label={t("chat_message_add_action")}
                        onClick={handlePlusClick}
                        onKeyDown={(event) => event.stopPropagation()}
                        size="small"
                        title={t("chat_message_more_actions")}
                        data-testid={DATA_TEST_ID.CHAT_MESSAGE_FIELD_PLUS_BUTTON}
                      >
                        <AnimatedDotBadge show={showPlusBadge}>
                          <AddIcon
                            sx={{ color: theme.palette.primary.dark }}
                            data-testid={DATA_TEST_ID.CHAT_MESSAGE_FIELD_PLUS_ICON}
                          />
                        </AnimatedDotBadge>
                      </IconButton>
                    </motion.div>
                  )}
                </AnimatePresence>
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  data-testid={DATA_TEST_ID.CHAT_MESSAGE_FIELD_SEND_BUTTON}
                  onClick={handleButtonClick}
                  onKeyDown={(event) => event.stopPropagation()}
                  disabled={sendIsDisabled()}
                  title={t("chat_message_send_message")}
                >
                  <SendIcon
                    data-testid={DATA_TEST_ID.CHAT_MESSAGE_FIELD_SEND_ICON}
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
        {/* Hidden input for file selection */}
        {isCvUploadEnabled && (
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept=".pdf,.docx,.txt"
            onChange={handleFileSelected}
            data-testid={DATA_TEST_ID.CHAT_MESSAGE_FIELD_HIDDEN_FILE_INPUT}
          />
        )}
        {/* Context menu for plus actions using a themed icon button with text */}
        {isCvUploadEnabled && (
          <ContextMenu
            anchorEl={menuAnchorEl}
            open={isMenuOpen}
            notifyOnClose={handleMenuClose}
            anchorOrigin={{ vertical: "top", horizontal: "left" }}
            transformOrigin={{ vertical: "bottom", horizontal: "left" }}
            items={contextMenuItems}
            paperSx={{ width: 420 }}
          />
        )}
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