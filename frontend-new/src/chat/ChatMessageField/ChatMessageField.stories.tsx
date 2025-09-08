import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import ChatMessageField, { ChatMessageFieldProps } from "./ChatMessageField";
import { action } from "@storybook/addon-actions";
import { StatusCodes } from "http-status-codes";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { ConversationPhase } from "src/chat/chatProgressbar/types";

const meta: Meta<typeof ChatMessageField> = {
  title: "Chat/ChatMessageField",
  component: ChatMessageField,
  tags: ["autodocs"],
  argTypes: {
    handleSend: { action: "message sent" },
  },
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

export const Shown: Story = {
  render: (args) => <ChatMessageFieldWrapper {...args} />,
  args: {
    handleSend: action("Message sent"),
    currentPhase: ConversationPhase.INTRO,
  },
};

export const AIIsTyping: Story = {
  render: (args) => <ChatMessageFieldWrapper {...args} />,
  args: {
    handleSend: action("Message sent"),
    aiIsTyping: true,
    currentPhase: ConversationPhase.INTRO,
  },
};

export const ChatIsClosed: Story = {
  render: (args) => <ChatMessageFieldWrapper {...args} />,
  args: {
    handleSend: action("Message sent"),
    isChatFinished: true,
    currentPhase: ConversationPhase.INTRO,
  },
};

// --- CV Upload Stories (mock onUploadCv) ---

const successUpload: ChatMessageFieldProps["onUploadCv"] = async (_file: File) => {
  return [
    "I worked as a project manager at the University of Oxford, from 2018 to 2020. I worked remotely.",
    "I co-founded Acme Inc. in 2022, a gen-ai startup based in DC, USA. My role was CEO.",
  ];
};

const emptyUpload: ChatMessageFieldProps["onUploadCv"] = async (_file: File) => {
  return [];
};

const tooLargeErrorUpload: ChatMessageFieldProps["onUploadCv"] = async (_file: File) => {
  const error: any = {
    statusCode: StatusCodes.REQUEST_TOO_LONG,
    errorCode: ErrorConstants.ErrorCodes.TOO_LARGE_PAYLOAD,
    message: "Payload too large",
  };
  return Promise.reject(error);
};

const genericErrorUpload: ChatMessageFieldProps["onUploadCv"] = async (_file: File) => {
  return Promise.reject({ statusCode: 500, errorCode: "UNKNOWN", message: "Unexpected error" });
};

export const CVUploadSuccess: Story = {
  render: (args) => <ChatMessageFieldWrapper {...args} />,
  args: {
    handleSend: action("Message sent"),
    onUploadCv: successUpload,
    currentPhase: ConversationPhase.COLLECT_EXPERIENCES,
  },
};

export const CVUploadEmptyResponse: Story = {
  render: (args) => <ChatMessageFieldWrapper {...args} />,
  args: {
    handleSend: action("Message sent"),
    onUploadCv: emptyUpload,
    currentPhase: ConversationPhase.COLLECT_EXPERIENCES,
  },
};

export const CVUploadPayloadTooLarge: Story = {
  render: (args) => <ChatMessageFieldWrapper {...args} />,
  args: {
    handleSend: action("Message sent"),
    onUploadCv: tooLargeErrorUpload,
    currentPhase: ConversationPhase.COLLECT_EXPERIENCES,
  },
};

export const CVUploadGenericError: Story = {
  render: (args) => <ChatMessageFieldWrapper {...args} />,
  args: {
    handleSend: action("Message sent"),
    onUploadCv: genericErrorUpload,
    currentPhase: ConversationPhase.COLLECT_EXPERIENCES,
  },
};

export const PlusBadgeAppearsOnPhaseTransition: Story = {
  render: (args) => <ChatMessageFieldWrapper {...args} />,
  args: {
    handleSend: action("Message sent"),
    currentPhase: ConversationPhase.COLLECT_EXPERIENCES,
  },
};

export const CVUploadDisabledInOtherPhases: Story = {
    render: (args) => <ChatMessageFieldWrapper {...args} />,
    args: {
        handleSend: action("Message sent"),
        currentPhase: ConversationPhase.INTRO,
    },
}