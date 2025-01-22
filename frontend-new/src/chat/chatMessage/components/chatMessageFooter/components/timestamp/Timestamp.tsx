import { Typography, styled } from "@mui/material";
import { getDurationFromNow } from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/getDurationFromNow/getDurationFromNow";

const uniqueId = "c9253326-05ee-4bff-9d43-7852ca78a033";

export const DATA_TEST_ID = {
  TIMESTAMP: `chat-message-timestamp-${uniqueId}`,
};

export interface ChatMessageFooterProps {
  sentAt: string
}

const TimeStamp = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.body2.fontSize,
  color: theme.palette.text.secondary,
  marginTop: theme.spacing(theme.tabiyaSpacing.xs),
}));


const Timestamp: React.FC<ChatMessageFooterProps> = ({ sentAt }) => {
  let duration;
  try {
    duration = getDurationFromNow(new Date(sentAt));
  } catch (e) {
    console.error(new Error("Failed to get message duration", { cause: e }));
  }

  return (
    <TimeStamp data-testid={DATA_TEST_ID.TIMESTAMP} variant="caption">
      sent {duration}
    </TimeStamp>
  )
}

export default Timestamp;