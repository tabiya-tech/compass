import { ReactElement } from "react";
import { ConversationMessageSender } from "./ChatService/ChatService.types";

export type IChatMessage<T> = {
  type: string;
  message_id: string;
  sender: ConversationMessageSender;
  payload: T;
  component: (props: T) => ReactElement<T>;
};

export type UploadProcessState =
  | "PENDING_UPLOAD"
  | "UPLOADING"
  | "CONVERTING"
  | "UPLOADING_TO_GCS"
  | "EXTRACTING"
  | "SAVING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface UploadStatus {
  upload_process_state: UploadProcessState;
  cancel_requested?: boolean;
  filename?: string;
  user_id?: string;
  upload_id?: string;
  created_at?: string;
  last_activity_at?: string;
  error_code?: string | null;
  error_detail?: string | null;
  experience_bullets?: string[] | null;
}