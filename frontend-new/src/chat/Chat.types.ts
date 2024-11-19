import { ConversationMessage } from "./ChatService/ChatService.types";

export type IChatMessage = ConversationMessage & {
  id: string;
  isFeedbackMessage?: boolean;
};

export type TNewSesionResponse = {
  session_id: number;
};
