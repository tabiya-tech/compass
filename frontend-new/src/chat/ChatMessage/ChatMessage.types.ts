export enum ChatMessageOrigin {
  COMPASS = "compass",
  ME = "me",
}

export type ChatMessageProps = {
  origin: ChatMessageOrigin;
  message: string;
  time: Date;
};
