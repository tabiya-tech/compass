import { ReactElement } from "react";
import { ConversationMessageSender } from "./ChatService/ChatService.types";

export type IChatMessage<T> = {
  type: string;
  message_id: string;
  sender: ConversationMessageSender;
  payload: T;
  component: (props: T) => ReactElement<T>;
};