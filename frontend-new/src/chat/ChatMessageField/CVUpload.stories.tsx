import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import ChatMessageField, { ChatMessageFieldProps, DATA_TEST_ID } from "./ChatMessageField";
import { action } from "@storybook/addon-actions";
import { StatusCodes } from "http-status-codes";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { ConversationPhase } from "src/chat/chatProgressbar/types";

const meta: Meta<typeof ChatMessageField> = {
  title: "Chat/ChatMessageField/CV Upload",
  component: ChatMessageField,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <IsOnlineContext.Provider value={true}>
        <div style={{ padding: 24 }}>
          <Story />
        </div>
      </IsOnlineContext.Provider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof ChatMessageField>;

const ChatMessageFieldWrapper: React.FC<ChatMessageFieldProps> = (props) => {
  const handleSend = (message: string) => {
    props.handleSend(message);
  };
  return <ChatMessageField {...props} handleSend={handleSend} />;
};

// Mocked upload handlers to trigger inline errors
const duplicateCvErrorUpload: ChatMessageFieldProps["onUploadCv"] = async (_file: File) => {
  return Promise.reject({ statusCode: StatusCodes.CONFLICT, message: "Duplicate CV" });
};

const unsupportedTypeErrorUpload: ChatMessageFieldProps["onUploadCv"] = async (_file: File) => {
  return Promise.reject({ statusCode: StatusCodes.UNSUPPORTED_MEDIA_TYPE, message: "Unsupported type" });
};

const tooLargeErrorUpload: ChatMessageFieldProps["onUploadCv"] = async (_file: File) => {
  return Promise.reject({ statusCode: StatusCodes.REQUEST_TOO_LONG, message: "Payload too large" });
};

const tooManyRequestsErrorUpload: ChatMessageFieldProps["onUploadCv"] = async (_file: File) => {
  return Promise.reject({ statusCode: StatusCodes.TOO_MANY_REQUESTS, message: "Rate limited" });
};

const forbiddenErrorUpload: ChatMessageFieldProps["onUploadCv"] = async (_file: File) => {
  return Promise.reject({ statusCode: StatusCodes.FORBIDDEN, message: "Max uploads reached" });
};

const timeoutErrorUpload: ChatMessageFieldProps["onUploadCv"] = async (_file: File) => {
  return Promise.reject({ statusCode: StatusCodes.REQUEST_TIMEOUT, message: "Timeout" });
};

// Auto-select file to showcase inline error without clicks
const AutoSelectFileStory: React.FC<ChatMessageFieldProps & { fileName?: string }> = (props) => {
  React.useEffect(() => {
    const input: HTMLInputElement | null = document.querySelector(
      `[data-testid="${DATA_TEST_ID.CHAT_MESSAGE_FIELD_HIDDEN_FILE_INPUT}"]`
    );
    if (!input) return;
    try {
      const file = new File(["dummy"], props.fileName ?? "cv.pdf", { type: "application/pdf" });
      Object.defineProperty(input, "files", { value: [file] });
      const event = new Event("change", { bubbles: true });
      input.dispatchEvent(event);
    } catch (_e) {
      // silently ignore when environment blocks programmatic file assignment
    }
  }, [props.fileName]);
  return <ChatMessageFieldWrapper {...props} />;
};

export const DuplicateCV: Story = {
  render: (args) => <AutoSelectFileStory {...args} />,
  args: {
    handleSend: action("Message sent"),
    onUploadCv: duplicateCvErrorUpload,
    currentPhase: ConversationPhase.COLLECT_EXPERIENCES,
  },
};

export const UnsupportedType: Story = {
  render: (args) => <AutoSelectFileStory {...args} />,
  args: {
    handleSend: action("Message sent"),
    onUploadCv: unsupportedTypeErrorUpload,
    currentPhase: ConversationPhase.COLLECT_EXPERIENCES,
  },
};

export const PayloadTooLarge: Story = {
  render: (args) => <AutoSelectFileStory {...args} />,
  args: {
    handleSend: action("Message sent"),
    onUploadCv: tooLargeErrorUpload,
    currentPhase: ConversationPhase.COLLECT_EXPERIENCES,
  },
};

export const TooManyRequests: Story = {
  render: (args) => <AutoSelectFileStory {...args} />,
  args: {
    handleSend: action("Message sent"),
    onUploadCv: tooManyRequestsErrorUpload,
    currentPhase: ConversationPhase.COLLECT_EXPERIENCES,
  },
};

export const Forbidden: Story = {
  render: (args) => <AutoSelectFileStory {...args} />,
  args: {
    handleSend: action("Message sent"),
    onUploadCv: forbiddenErrorUpload,
    currentPhase: ConversationPhase.COLLECT_EXPERIENCES,
  },
};

export const Timeout: Story = {
  render: (args) => <AutoSelectFileStory {...args} />,
  args: {
    handleSend: action("Message sent"),
    onUploadCv: timeoutErrorUpload,
    currentPhase: ConversationPhase.COLLECT_EXPERIENCES,
  },
};

export const UploadingDisabledState: Story = {
  render: (args) => <ChatMessageFieldWrapper {...args} />,
  args: {
    handleSend: action("Message sent"),
    isUploadingCv: true,
    currentPhase: ConversationPhase.COLLECT_EXPERIENCES,
  },
};


