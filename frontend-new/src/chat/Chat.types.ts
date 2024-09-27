import { ConversationMessage } from "./ChatService/ChatService.types";

export type IChatMessage = ConversationMessage & {
  id: string;
};

export type TNewSesionResponse = {
  session_id: number;
};
