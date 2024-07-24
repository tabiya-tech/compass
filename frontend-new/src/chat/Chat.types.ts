import { ConversationMessage } from "./ChatService/ChatService.types";

export type IChatMessage = ConversationMessage & {
  id: number;
};

export type TNewSesionResponse = {
  session_id: number;
};
