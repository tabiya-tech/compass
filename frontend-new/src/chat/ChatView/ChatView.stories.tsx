import React, { ReactElement, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Box, useTheme } from "@mui/material";
import { action } from "@storybook/addon-actions";
import ChatView from "./ChatView";
import { IChatMessage } from "src/chat/Chat.types";
import { ConversationMessageSender, QuickReplyOption } from "src/chat/ChatService/ChatService.types";
import { nanoid } from "nanoid";
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
import ErrorChatMessage, {
  ERROR_CHAT_MESSAGE_TYPE,
  ErrorChatMessageProps,
} from "src/chat/chatMessage/errorChatMessage/ErrorChatMessage";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";

// Helper function to create a message with its component
const createMessage = (
  message: string,
  sender: ConversationMessageSender,
  type: string = USER_CHAT_MESSAGE_TYPE,
  reaction: any = null,
  fillColor?: string
): IChatMessage<any> => {
  const messageData = {
    message_id: nanoid(),
    sender,
    message,
    sent_at: new Date().toISOString(),
    type,
    reaction,
    fill_color: fillColor,
  };

  let component: (props: any) => ReactElement<any>;
  if (type === TYPING_CHAT_MESSAGE_TYPE) {
    component = (props) => <TypingChatMessage {...(props as TypingChatMessageProps)} />;
  } else if (type === ERROR_CHAT_MESSAGE_TYPE) {
    component = (props) => <ErrorChatMessage {...(props as ErrorChatMessageProps)} />;
  } else {
    component =
      sender === ConversationMessageSender.USER
        ? (props) => <UserChatMessage {...(props as UserChatMessageProps)} />
        : (props) => <CompassChatMessage {...(props as CompassChatMessageProps)} />;
  }

  return {
    type: messageData.type,
    message_id: messageData.message_id,
    sender: messageData.sender,
    payload: messageData,
    component,
  };
};

// Sample messages for stories
const sampleConversation = [
  createMessage(
    "Hello! I'm Compass, your career exploration assistant. I'm here to help you discover your skills and explore career opportunities. What kind of work have you done before?",
    ConversationMessageSender.COMPASS,
    COMPASS_CHAT_MESSAGE_TYPE
  ),
  createMessage(
    "I worked as a baker for 5 years. I made bread, cakes, and pastries.",
    ConversationMessageSender.USER,
    USER_CHAT_MESSAGE_TYPE
  ),
  createMessage(
    "That's wonderful experience! Baking involves many valuable skills. Can you tell me more about your responsibilities? For example, did you manage inventory, train others, or handle customer orders?",
    ConversationMessageSender.COMPASS,
    COMPASS_CHAT_MESSAGE_TYPE
  ),
];

const sampleQuickReplyOptions: QuickReplyOption[] = [
  { label: "Yes, I managed inventory" },
  { label: "I trained new employees" },
  { label: "I handled customer orders" },
  { label: "All of the above" },
];

const meta: Meta<typeof ChatView> = {
  title: "Chat/ChatView",
  component: ChatView,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "ChatView is a reusable component that combines ChatList, QuickReplyButtons, and ChatMessageField into a single, cohesive chat interface. It handles the layout and rendering but does not make any backend calls.",
      },
    },
  },
  decorators: [
    (Story) => {
      // Mock UserPreferencesStateService
      const mockService = UserPreferencesStateService.getInstance();
      mockService.getActiveSessionId = () => 1234;
      mockService.activeSessionHasCustomerSatisfactionRating = () => false;
      mockService.activeSessionHasOverallFeedback = () => false;

      return (
        <IsOnlineContext.Provider value={true}>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
              overflow: "hidden",
              maxHeight: "100vh",
            }}
          >
            <Story />
          </Box>
        </IsOnlineContext.Provider>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof ChatView>;

// ============================================================================
// Basic Stories
// ============================================================================

export const Default: Story = {
  args: {
    messages: sampleConversation,
    messageFieldProps: {
      handleSend: action("Message sent"),
      aiIsTyping: false,
      isChatFinished: false,
    },
  },
};

export const Empty: Story = {
  args: {
    messages: [],
    messageFieldProps: {
      handleSend: action("Message sent"),
      aiIsTyping: false,
      isChatFinished: false,
    },
  },
  parameters: {
    docs: {
      description: {
        story: "ChatView with no messages - shows only the input field.",
      },
    },
  },
};

export const SingleMessage: Story = {
  args: {
    messages: [
      createMessage(
        "Welcome to Compass! I'm here to help you explore your career options. What would you like to discuss today?",
        ConversationMessageSender.COMPASS,
        COMPASS_CHAT_MESSAGE_TYPE
      ),
    ],
    messageFieldProps: {
      handleSend: action("Message sent"),
      aiIsTyping: false,
      isChatFinished: false,
    },
  },
  parameters: {
    docs: {
      description: {
        story: "ChatView with a single welcome message from Compass.",
      },
    },
  },
};

// ============================================================================
// Quick Reply Stories
// ============================================================================

export const WithQuickReplies: Story = {
  args: {
    messages: sampleConversation,
    quickReplyOptions: sampleQuickReplyOptions,
    onQuickReplyClick: action("Quick reply clicked"),
    messageFieldProps: {
      handleSend: action("Message sent"),
      aiIsTyping: false,
      isChatFinished: false,
    },
  },
  parameters: {
    docs: {
      description: {
        story: "ChatView with quick reply buttons displayed above the input field.",
      },
    },
  },
};

export const WithSingleQuickReply: Story = {
  args: {
    messages: [
      createMessage(
        "Would you like to continue exploring your skills?",
        ConversationMessageSender.COMPASS,
        COMPASS_CHAT_MESSAGE_TYPE
      ),
    ],
    quickReplyOptions: [{ label: "Yes, let's continue" }],
    onQuickReplyClick: action("Quick reply clicked"),
    messageFieldProps: {
      handleSend: action("Message sent"),
      aiIsTyping: false,
      isChatFinished: false,
    },
  },
  parameters: {
    docs: {
      description: {
        story: "ChatView with a single quick reply option.",
      },
    },
  },
};

export const WithManyQuickReplies: Story = {
  args: {
    messages: [
      createMessage(
        "Which area would you like to focus on?",
        ConversationMessageSender.COMPASS,
        COMPASS_CHAT_MESSAGE_TYPE
      ),
    ],
    quickReplyOptions: [
      { label: "Technical skills" },
      { label: "Soft skills" },
      { label: "Leadership experience" },
      { label: "Communication" },
      { label: "Problem solving" },
      { label: "Time management" },
      { label: "Teamwork" },
    ],
    onQuickReplyClick: action("Quick reply clicked"),
    messageFieldProps: {
      handleSend: action("Message sent"),
      aiIsTyping: false,
      isChatFinished: false,
    },
  },
  parameters: {
    docs: {
      description: {
        story: "ChatView with many quick reply options that wrap to multiple lines.",
      },
    },
  },
};

export const WithLongQuickReplyText: Story = {
  args: {
    messages: [
      createMessage(
        "Please select the option that best describes your experience:",
        ConversationMessageSender.COMPASS,
        COMPASS_CHAT_MESSAGE_TYPE
      ),
    ],
    quickReplyOptions: [
      { label: "I managed a team of 10+ employees and handled all hiring decisions" },
      { label: "I worked independently but collaborated with others on projects" },
      { label: "I was responsible for training new staff members" },
    ],
    onQuickReplyClick: action("Quick reply clicked"),
    messageFieldProps: {
      handleSend: action("Message sent"),
      aiIsTyping: false,
      isChatFinished: false,
    },
  },
  parameters: {
    docs: {
      description: {
        story: "ChatView with quick reply options containing longer text.",
      },
    },
  },
};

// ============================================================================
// Loading/Typing States
// ============================================================================

export const AITyping: Story = {
  args: {
    messages: [...sampleConversation, createMessage("", ConversationMessageSender.COMPASS, TYPING_CHAT_MESSAGE_TYPE)],
    messageFieldProps: {
      handleSend: action("Message sent"),
      aiIsTyping: true,
      isChatFinished: false,
    },
  },
  parameters: {
    docs: {
      description: {
        story: "ChatView showing the AI typing indicator. The input field is disabled while AI is typing.",
      },
    },
  },
};

export const AITypingWithQuickReplies: Story = {
  args: {
    messages: [...sampleConversation, createMessage("", ConversationMessageSender.COMPASS, TYPING_CHAT_MESSAGE_TYPE)],
    quickReplyOptions: sampleQuickReplyOptions,
    onQuickReplyClick: action("Quick reply clicked"),
    messageFieldProps: {
      handleSend: action("Message sent"),
      aiIsTyping: true,
      isChatFinished: false,
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "ChatView showing typing indicator with quick replies still visible. Quick replies remain visible until the user sends a message.",
      },
    },
  },
};

// ============================================================================
// Chat States
// ============================================================================

export const ChatFinished: Story = {
  args: {
    messages: [
      ...sampleConversation,
      createMessage(
        "Thank you for exploring your skills with me today! You've identified many valuable competencies. Good luck with your career journey!",
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
  parameters: {
    docs: {
      description: {
        story: "ChatView when the conversation is finished. The input field is disabled.",
      },
    },
  },
};

export const InputDisabled: Story = {
  args: {
    messages: sampleConversation,
    messageFieldProps: {
      handleSend: action("Message sent"),
      aiIsTyping: false,
      isChatFinished: false,
      isInputDisabled: true,
      customPlaceholder: "Please complete the quiz before continuing...",
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "ChatView with input disabled and a custom placeholder message (e.g., when waiting for quiz completion).",
      },
    },
  },
};

// ============================================================================
// Error States
// ============================================================================

export const WithErrorMessage: Story = {
  args: {
    messages: [
      ...sampleConversation,
      createMessage(
        "Something went wrong. Please try again.",
        ConversationMessageSender.COMPASS,
        ERROR_CHAT_MESSAGE_TYPE
      ),
    ],
    messageFieldProps: {
      handleSend: action("Message sent"),
      aiIsTyping: false,
      isChatFinished: false,
    },
  },
  parameters: {
    docs: {
      description: {
        story: "ChatView displaying an error message in the conversation.",
      },
    },
  },
};

// ============================================================================
// Custom Styling
// ============================================================================

const WithCustomFillColorRenderer: React.FC = () => {
  const theme = useTheme();
  return (
    <ChatView
      messages={sampleConversation}
      quickReplyOptions={sampleQuickReplyOptions}
      onQuickReplyClick={action("Quick reply clicked")}
      messageFieldProps={{
        handleSend: action("Message sent"),
        aiIsTyping: false,
        isChatFinished: false,
        fillColor: theme.palette.secondary.main,
      }}
    />
  );
};

export const WithCustomFillColor: Story = {
  render: () => <WithCustomFillColorRenderer />,
  parameters: {
    docs: {
      description: {
        story: "ChatView with a custom fill color for the input field (primary color).",
      },
    },
  },
};

const WithBrandActionColorRenderer: React.FC = () => {
  const theme = useTheme();
  return (
    <ChatView
      messages={sampleConversation}
      messageFieldProps={{
        handleSend: action("Message sent"),
        aiIsTyping: false,
        isChatFinished: false,
        fillColor: theme.palette.primary?.main || theme.palette.info.main,
      }}
    />
  );
};

export const WithBrandActionColor: Story = {
  render: () => <WithBrandActionColorRenderer />,
  parameters: {
    docs: {
      description: {
        story: "ChatView with brand action color (used in Career Explorer).",
      },
    },
  },
};

// ============================================================================
// Long Conversations
// ============================================================================

export const LongConversation: Story = {
  args: {
    messages: Array.from({ length: 20 }, (_, i) =>
      createMessage(
        i % 2 === 0
          ? `This is message ${i + 1} from Compass. It contains some helpful information about career exploration and skill discovery.`
          : `This is my response ${i + 1}. I'm sharing my work experience and skills with Compass.`,
        i % 2 === 0 ? ConversationMessageSender.COMPASS : ConversationMessageSender.USER,
        i % 2 === 0 ? COMPASS_CHAT_MESSAGE_TYPE : USER_CHAT_MESSAGE_TYPE
      )
    ),
    messageFieldProps: {
      handleSend: action("Message sent"),
      aiIsTyping: false,
      isChatFinished: false,
    },
  },
  parameters: {
    docs: {
      description: {
        story: "ChatView with a long conversation to demonstrate scrolling behavior.",
      },
    },
  },
};

// ============================================================================
// Interactive Story
// ============================================================================

const InteractiveChatView: React.FC = () => {
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
    { label: "I worked in healthcare" },
  ]);

  const handleSend = (message: string) => {
    // Add user message
    setMessages((prev) => [...prev, createMessage(message, ConversationMessageSender.USER, USER_CHAT_MESSAGE_TYPE)]);

    // Clear quick replies
    setQuickReplies(null);

    // Simulate AI typing
    setAiIsTyping(true);

    // Simulate AI response after delay
    setTimeout(() => {
      setAiIsTyping(false);
      setMessages((prev) => [
        ...prev,
        createMessage(
          `Thanks for sharing! "${message}" sounds like valuable experience. Would you like to tell me more about specific skills you developed?`,
          ConversationMessageSender.COMPASS,
          COMPASS_CHAT_MESSAGE_TYPE
        ),
      ]);
      setQuickReplies([
        { label: "Customer service skills" },
        { label: "Technical skills" },
        { label: "Leadership skills" },
      ]);
    }, 1500);
  };

  const handleQuickReply = (label: string) => {
    handleSend(label);
  };

  return (
    <ChatView
      messages={
        aiIsTyping
          ? [...messages, createMessage("", ConversationMessageSender.COMPASS, TYPING_CHAT_MESSAGE_TYPE)]
          : messages
      }
      quickReplyOptions={quickReplies}
      onQuickReplyClick={handleQuickReply}
      messageFieldProps={{
        handleSend,
        aiIsTyping,
        isChatFinished: false,
        fillColor: theme.palette.tertiary.main,
      }}
    />
  );
};

export const Interactive: Story = {
  render: () => <InteractiveChatView />,
  parameters: {
    docs: {
      description: {
        story:
          "An interactive ChatView where you can type messages and see simulated AI responses. Quick reply buttons are also functional.",
      },
    },
  },
};

// ============================================================================
// With Children (Overlay)
// ============================================================================

export const WithOverlayChild: Story = {
  args: {
    messages: sampleConversation,
    messageFieldProps: {
      handleSend: action("Message sent"),
      aiIsTyping: false,
      isChatFinished: false,
    },
    children: (
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: "1.5rem",
          zIndex: 10,
        }}
      >
        Session Inactive - Click to Resume
      </Box>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          "ChatView with a child overlay component (e.g., an inactive session backdrop). Children are rendered between the messages area and input area.",
      },
    },
  },
};
