import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import ChatMessageField, { ChatMessageFieldProps, DATA_TEST_ID } from "./ChatMessageField";
import { action } from "@storybook/addon-actions";
import { StatusCodes } from "http-status-codes";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { ConversationPhase } from "src/chat/chatProgressbar/types";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import CVService from "src/CV/CVService/CVService";
import type { CVListItem } from "src/CV/CVService/CVService.types";

const meta: Meta<typeof ChatMessageField> = {
  title: "Chat/ChatMessageField/CV Upload",
  component: ChatMessageField,
  tags: ["autodocs"],
  decorators: [
    (Story) => {
      // Mock AuthenticationStateService
      const mockService = AuthenticationStateService.getInstance();
      mockService.getUser = () => ({
        id: "001",
        name: "Test User",
        email: "test@example.com",
      });

      return (
        <IsOnlineContext.Provider value={true}>
          <div style={{ padding: 24 }}>
            <Story />
          </div>
        </IsOnlineContext.Provider>
      );
    },
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

// create a list of mock, previously uploaded CVs (all in COMPLETED state)
const createMockCvList = (count: number): CVListItem[] => {
  const FILE_EXTENSIONS = ["pdf", "docx", "txt"] as const;
  const BASE_NAMES = ["Resume", "CV", "Experience_Summary", "Profile", "Work_History", "Professional_Resume"] as const;

  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];
  const makeRandomCvFilename = (idx: number) => `${pick(BASE_NAMES)}_John_Doe_${idx + 1}.${pick(FILE_EXTENSIONS)}`;

  return Array.from({ length: count }).map((_, idx) => ({
    upload_id: `cv-${idx + 1}`,
    filename: makeRandomCvFilename(idx),
    uploaded_at: new Date(Date.now() - idx * 3600_000).toISOString(),
    upload_process_state: "COMPLETED",
  }));
};

// temporarily mock CVService.getInstance().getAllCVs for this story instance
const WithMockedCvService: React.FC<ChatMessageFieldProps & { items: CVListItem[] }> = (props) => {
  React.useEffect(() => {
    const originalGetInstance = (CVService as any).getInstance;
    const mockInstance = { getAllCVs: async (_userId: string) => props.items };
    (CVService as any).getInstance = () => mockInstance;
    return () => {
      (CVService as any).getInstance = originalGetInstance;
    };
  }, [props.items]);

  return <ChatMessageFieldWrapper {...props} />;
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

export const CharacterLimitWithCVResponse: Story = {
  render: (args) => <ChatMessageFieldWrapper {...args} />,
  args: {
    handleSend: action("Message sent"),
    currentPhase: ConversationPhase.COLLECT_EXPERIENCES,
    prefillMessage: `I have extensive experience in software development with expertise in React, TypeScript, Node.js, Python, and cloud technologies. I've worked on multiple projects including e-commerce platforms, data analytics systems, and mobile applications. My key achievements include leading a team of 5 developers to deliver a high-traffic web application serving over 100,000 users, implementing microservices architecture that improved system performance by 40%, and developing automated testing frameworks that reduced deployment time by 60%. I have strong problem-solving skills, excellent communication abilities, and a passion for continuous learning. I'm proficient in agile methodologies, version control with Git, CI/CD pipelines, and have experience with AWS, Docker, and Kubernetes. I've also contributed to open-source projects and have published technical articles on software architecture best practices. My educational background includes a Bachelor's degree in Computer Science and several professional certifications in cloud computing and project management. I'm looking for opportunities to work on challenging projects that allow me to grow as a developer and contribute to innovative solutions. I believe my technical skills combined with my leadership experience make me a valuable addition to any development team. I'm particularly interested in roles that involve full-stack development, system design, and mentoring junior developers. I'm excited about the possibility of joining your team and contributing to your mission of creating impactful software solutions.`, // Long CV response that exceeds limit
  },
};

export const CVMarkdownTooLong: Story = {
  render: (args) => <ChatMessageFieldWrapper {...args} />,
  args: {
    handleSend: action("Message sent"),
    currentPhase: ConversationPhase.COLLECT_EXPERIENCES,
    cvUploadError: "Your CV content is too long. Please shorten your CV and try again.",
  },
};



export const SinglePreviouslyUploadedCV: Story = {
  render: (args) => <WithMockedCvService {...args} items={createMockCvList(1)} />,
  args: {
    handleSend: action("Message sent"),
    currentPhase: ConversationPhase.COLLECT_EXPERIENCES,
  },
};

export const MultiplePreviouslyUploadedCVs: Story = {
  render: (args) => <WithMockedCvService {...args} items={createMockCvList(3)} />,
  args: {
    handleSend: action("Message sent"),
    currentPhase: ConversationPhase.COLLECT_EXPERIENCES,
  },
};

export const ManyPreviouslyUploadedCVs: Story = {
  render: (args) => <WithMockedCvService {...args} items={createMockCvList(10)} />,
  args: {
    handleSend: action("Message sent"),
    currentPhase: ConversationPhase.COLLECT_EXPERIENCES,
  },
};
