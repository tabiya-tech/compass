import { Typography, styled } from "@mui/material";
import { getDurationFromNow } from "src/utils/getDurationFromNow/getDurationFromNow";

const uniqueId = "7772f20a-9d0c-4072-b24f-97eca2f43d7b";

export const DATA_TEST_ID = {
  CHAT_MESSAGE_TIMESTAMP: `chat-message-sent_at-${uniqueId}`,
};

export interface ChatMessageFooterProps {
  sentAt: string
}

const TimeStamp = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.body2.fontSize,
  color: theme.palette.text.secondary,
  marginTop: theme.spacing(theme.tabiyaSpacing.xs),
}));


const ChatMessageFooter: React.FC<ChatMessageFooterProps> = ({ sentAt }) => {
  let duration;
  try {
    duration = getDurationFromNow(new Date(sentAt));
  } catch (e) {
    console.error(new Error("Failed to get message duration", { cause: e }));
  }

  return (
    <TimeStamp data-testid={DATA_TEST_ID.CHAT_MESSAGE_TIMESTAMP} variant="caption">
      sent {duration}
    </TimeStamp>
  )
}

export default ChatMessageFooter;