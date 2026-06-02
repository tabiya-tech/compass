import React, { ReactElement, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Box, useTheme } from "@mui/material";
import { action } from "@storybook/addon-actions";
import { nanoid } from "nanoid";
import ChatPage from "./ChatPage";
import { IChatMessage } from "src/chat/Chat.types";
import { ConversationMessageSender, QuickReplyOption } from "src/chat/ChatService/ChatService.types";
import CompassChatMessage, {
  CompassChatMessageProps,
  COMPASS_CHAT_MESSAGE_TYPE,
} from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import UserChatMessage, {
  UserChatMessageProps,
  USER_CHAT_MESSAGE_TYPE,
} from "src/chat/chatMessage/userChatMessage/UserChatMessage";
import TypingChatMessage, {
  TypingChatMessageProps,
  TYPING_CHAT_MESSAGE_TYPE,
} from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import Sidebar from "src/theme/Sidebar/Sidebar";
import SidebarService from "src/home/components/Sidebar/SidebarService";
import SkillsDiscoverySidebar from "src/home/components/Sidebar/SkillsDiscoverySidebar";
import { ConversationPhase, defaultCurrentPhase } from "src/chat/chatProgressbar/types";
import CareerExplorerSidebar from "src/home/components/Sidebar/CareerExplorerSidebar";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const createMessage = (
  message: string,
  sender: ConversationMessageSender,
  type: string = USER_CHAT_MESSAGE_TYPE
): IChatMessage<any> => {
  const payload = {
    message_id: nanoid(),
    sender,
    message,
    sent_at: new Date().toISOString(),
    type,
    reaction: null,
  };

  let component: (props: any) => ReactElement<any>;
  if (type === TYPING_CHAT_MESSAGE_TYPE) {
    component = (props) => <TypingChatMessage {...(props as TypingChatMessageProps)} />;
  } else {
    component =
      sender === ConversationMessageSender.USER
        ? (props) => <UserChatMessage {...(props as UserChatMessageProps)} />
        : (props) => <CompassChatMessage {...(props as CompassChatMessageProps)} />;
  }

  return { type: payload.type, message_id: payload.message_id, sender: payload.sender, payload, component };
};

const sampleConversation: IChatMessage<any>[] = [
  createMessage(
    "Hello! I'm Compass, your career exploration assistant. What kind of work have you done before?",
    ConversationMessageSender.COMPASS,
    COMPASS_CHAT_MESSAGE_TYPE
  ),
  createMessage("I worked as a baker for 5 years.", ConversationMessageSender.USER, USER_CHAT_MESSAGE_TYPE),
  createMessage(
    "That's wonderful! Baking involves many valuable skills. Can you tell me more about your day-to-day responsibilities?",
    ConversationMessageSender.COMPASS,
    COMPASS_CHAT_MESSAGE_TYPE
  ),
];

const sampleQuickReplies: QuickReplyOption[] = [
  { label: "I managed inventory" },
  { label: "I trained new employees" },
  { label: "I handled customer orders" },
];

// ─── Stubs for sidebar services ──────────────────────────────────────────────

const stubSkillsSidebar = () => {
  (SidebarService.getInstance() as any).getSkillsData = async () => ({
    skills: ["Communication", "Teamwork", "Time management", "Customer service", "Attention to detail"],
  });
};

const stubCareerExplorerSidebar = () => {
  (SidebarService.getInstance() as any).getSectorData = async () => ({
    sectors: [
      {
        id: "agri",
        emoji: "🌾",
        name: "Agriculture",
        salaryRange: "K3 000–K6 000",
        description: "Zambia's largest employer with growing agri-business opportunities.",
      },
      {
        id: "tourism",
        emoji: "🦁",
        name: "Tourism",
        salaryRange: "K4 000–K8 000",
        description: "Wildlife lodges and national parks drive strong demand for hospitality staff.",
      },
    ],
  });
};

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<typeof ChatPage> = {
  title: "Chat/ChatPage",
  component: ChatPage,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Full-height page layout that centres the ChatView (max-width 50%) and optionally anchors a sidebar to the right edge of the viewport (max-width 10rem, hidden on mobile).",
      },
    },
  },
  decorators: [
    (Story) => {
      const mockService = UserPreferencesStateService.getInstance();
      mockService.getActiveSessionId = () => 1234;
      mockService.activeSessionHasCustomerSatisfactionRating = () => false;
      mockService.activeSessionHasOverallFeedback = () => false;

      return (
        <IsOnlineContext.Provider value={true}>
          <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <Story />
          </Box>
        </IsOnlineContext.Provider>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof ChatPage>;

// ─── Stories ─────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "Default — no sidebar",
  args: {
    chatViewProps: {
      messages: sampleConversation,
      messageFieldProps: {
        handleSend: action("Message sent"),
        aiIsTyping: false,
        isChatFinished: false,
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story: "ChatPage with only the centred chat area and no sidebar.",
      },
    },
  },
};

export const WithQuickReplies: Story = {
  name: "With quick replies — no sidebar",
  args: {
    chatViewProps: {
      messages: sampleConversation,
      quickReplyOptions: sampleQuickReplies,
      onQuickReplyClick: action("Quick reply clicked"),
      messageFieldProps: {
        handleSend: action("Message sent"),
        aiIsTyping: false,
        isChatFinished: false,
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story: "ChatPage with quick-reply buttons above the input field.",
      },
    },
  },
};

export const WithSkillsSidebar: Story = {
  name: "With Skills Discovery sidebar",
  decorators: [
    (Story) => {
      stubSkillsSidebar();
      return <Story />;
    },
  ],
  args: {
    chatViewProps: {
      messages: sampleConversation,
      quickReplyOptions: sampleQuickReplies,
      onQuickReplyClick: action("Quick reply clicked"),
      messageFieldProps: {
        handleSend: action("Message sent"),
        aiIsTyping: false,
        isChatFinished: false,
      },
    },
    sidebar: (
      <SkillsDiscoverySidebar
        currentPhase={{
          ...defaultCurrentPhase,
          phase: ConversationPhase.COLLECT_EXPERIENCES,
          percentage: 30,
          current: 1,
          total: 3,
        }}
      />
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          "ChatPage with the SkillsDiscoverySidebar anchored to the right edge. Sidebar is hidden on screens narrower than md.",
      },
    },
  },
};

export const WithCareerExplorerSidebar: Story = {
  name: "With Career Explorer sidebar",
  decorators: [
    (Story) => {
      stubCareerExplorerSidebar();
      return <Story />;
    },
  ],
  args: {
    chatViewProps: {
      messages: sampleConversation,
      messageFieldProps: {
        handleSend: action("Message sent"),
        aiIsTyping: false,
        isChatFinished: false,
      },
    },
    sidebar: <CareerExplorerSidebar />,
  },
  parameters: {
    docs: {
      description: {
        story: "ChatPage with the CareerExplorerSidebar showing explored sectors.",
      },
    },
  },
};

export const WithCustomSidebar: Story = {
  name: "With custom sidebar content",
  args: {
    chatViewProps: {
      messages: sampleConversation,
      messageFieldProps: {
        handleSend: action("Message sent"),
        aiIsTyping: false,
        isChatFinished: false,
      },
    },
    sidebar: (
      <Sidebar title="Progress">
        <Box sx={{ fontSize: "0.75rem", color: "text.secondary", lineHeight: 1.6 }}>Step 1 of 4 — Work history</Box>
      </Sidebar>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: "ChatPage with arbitrary sidebar content passed via the sidebar prop.",
      },
    },
  },
};

export const AITyping: Story = {
  name: "AI typing — no sidebar",
  args: {
    chatViewProps: {
      messages: [...sampleConversation, createMessage("", ConversationMessageSender.COMPASS, TYPING_CHAT_MESSAGE_TYPE)],
      messageFieldProps: {
        handleSend: action("Message sent"),
        aiIsTyping: true,
        isChatFinished: false,
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story: "ChatPage while the AI is composing a response.",
      },
    },
  },
};

export const ChatFinished: Story = {
  name: "Chat finished — with sidebar",
  decorators: [
    (Story) => {
      stubSkillsSidebar();
      return <Story />;
    },
  ],
  args: {
    chatViewProps: {
      messages: [
        ...sampleConversation,
        createMessage(
          "Thank you for sharing your experience! You've identified many valuable skills. Good luck with your career journey.",
          ConversationMessageSender.COMPASS,
          COMPASS_CHAT_MESSAGE_TYPE
        ),
      ],
      messageFieldProps: {
        handleSend: action("Message sent"),
        aiIsTyping: false,
        isChatFinished: true,
      },
    },
    sidebar: (
      <SkillsDiscoverySidebar
        currentPhase={{
          ...defaultCurrentPhase,
          phase: ConversationPhase.COLLECT_EXPERIENCES,
          percentage: 30,
          current: 1,
          total: 3,
        }}
      />
    ),
  },
  parameters: {
    docs: {
      description: {
        story: "ChatPage with a finished conversation and the skills sidebar visible.",
      },
    },
  },
};

// ─── Interactive story ────────────────────────────────────────────────────────

const InteractiveChatPage: React.FC = () => {
  const theme = useTheme();
  const [messages, setMessages] = useState<IChatMessage<any>[]>([
    createMessage(
      "Hello! I'm Compass. Tell me about your work experience.",
      ConversationMessageSender.COMPASS,
      COMPASS_CHAT_MESSAGE_TYPE
    ),
  ]);
  const [aiIsTyping, setAiIsTyping] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReplyOption[] | null>([
    { label: "I worked in retail" },
    { label: "I worked in food service" },
    { label: "I worked in construction" },
  ]);

  const handleSend = (message: string) => {
    setMessages((prev) => [...prev, createMessage(message, ConversationMessageSender.USER, USER_CHAT_MESSAGE_TYPE)]);
    setQuickReplies(null);
    setAiIsTyping(true);
    setTimeout(() => {
      setAiIsTyping(false);
      setMessages((prev) => [
        ...prev,
        createMessage(
          `Thanks for sharing! "${message}" sounds like valuable experience. Would you like to tell me more?`,
          ConversationMessageSender.COMPASS,
          COMPASS_CHAT_MESSAGE_TYPE
        ),
      ]);
      setQuickReplies([{ label: "Yes, tell me more" }, { label: "Move on" }]);
    }, 1500);
  };

  return (
    <ChatPage
      chatViewProps={{
        messages: aiIsTyping
          ? [...messages, createMessage("", ConversationMessageSender.COMPASS, TYPING_CHAT_MESSAGE_TYPE)]
          : messages,
        quickReplyOptions: quickReplies,
        onQuickReplyClick: handleSend,
        messageFieldProps: {
          handleSend,
          aiIsTyping,
          isChatFinished: false,
          fillColor: theme.palette.secondary.main,
        },
      }}
      sidebar={
        <Sidebar title="Skills">
          <Box sx={{ fontSize: "0.75rem", color: "text.secondary" }}>Skills will appear here as you chat.</Box>
        </Sidebar>
      }
    />
  );
};

export const Interactive: Story = {
  render: () => <InteractiveChatPage />,
  parameters: {
    docs: {
      description: {
        story: "Fully interactive ChatPage — type a message or click a quick reply to see the conversation flow.",
      },
    },
  },
};
