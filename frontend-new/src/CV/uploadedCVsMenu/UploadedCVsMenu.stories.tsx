import { Meta, StoryObj } from "@storybook/react";
import UploadedCVsMenu from "src/CV/uploadedCVsMenu/UploadedCVsMenu";
import { ConversationPhase } from "src/chat/chatProgressbar/types";

const meta: Meta<typeof UploadedCVsMenu> = {
  title: "Chat/ChatMessageField/CV Upload/UploadedCVsMenuContent",
  component: UploadedCVsMenu,
  tags: ["autodocs"],
  argTypes: {
    onSelect: { action: "CV selected" },
  },
};

export default meta;

type Story = StoryObj<typeof UploadedCVsMenu>;

export const Shown: Story = {
  args: {
    uploadedCVs: [
      {
        upload_id: "1",
        filename: "John_Doe_CV.pdf",
        uploaded_at: new Date().toISOString(),
        upload_process_state: "COMPLETED",
        experiences_data: [],
      },
      {
        upload_id: "2",
        filename: "Jane_Smith_Resume.docx",
        uploaded_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        upload_process_state: "COMPLETED",
        experiences_data: [],
      },
    ],
    isLoading: false,
    currentPhase: ConversationPhase.COLLECT_EXPERIENCES,
  },
};

export const NoUploadedCVs: Story = {
  args: {
    uploadedCVs: [],
    isLoading: false,
  },
};

export const Disabled: Story = {
  args: {
    uploadedCVs: [
      {
        upload_id: "1",
        filename: "John_Doe_CV.pdf",
        uploaded_at: new Date().toISOString(),
        upload_process_state: "COMPLETED",
        experiences_data: [],
      },
    ],
    isLoading: false,
    currentPhase: ConversationPhase.INTRO,
  },
};

export const Loading: Story = {
  args: {
    uploadedCVs: [],
    isLoading: true,
  },
};
