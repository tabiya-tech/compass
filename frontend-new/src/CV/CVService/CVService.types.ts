import { UploadProcessState } from "src/chat/Chat.types";

export type CVListItem = {
  upload_id: string;
  filename: string;
  uploaded_at: string;
  upload_process_state: UploadProcessState;
  experiences_data: string[] | null;
};
