import { Meta } from "@storybook/react/*";
import UploadedCVsAccordion from "./UploadedCVsAccordion";
import { StoryObj } from "@storybook/react";

const meta: Meta<typeof UploadedCVsAccordion> = {
  title: "Chat/ChatMessageField/CV Upload/UploadedCVsAccordion",
  component: UploadedCVsAccordion,
  tags: ["autodocs"],
  argTypes: {
    onSelect: { action: "CV selected" },
  },
};

export default meta;

type Story = StoryObj<typeof UploadedCVsAccordion>;

export const Shown: Story = {
  args: {
    items: [
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
  },
};
