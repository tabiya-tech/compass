export enum ChatMessageOrigin {
  COMPASS = "compass",
  ME = "me",
}

export type IChatMessage = {
  id: number;
  origin: ChatMessageOrigin;
  message: string;
  timestamp: number;
};
