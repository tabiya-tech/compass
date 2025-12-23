import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import Chat from "./Chat";
import { getBackendUrl } from "src/envService";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import {
  Language,
  SensitivePersonalDataRequirement,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { ConversationPhase } from "src/chat/chatProgressbar/types";
import { nanoid } from "nanoid";

const CONVERSATION_HISTORY_URL = getBackendUrl() + "/conversations/:session_id/messages";
const NEW_SESSION_URL = getBackendUrl() + "/users/preferences/new-session";

// Generate a timestamp relative to now
const getTimestamp = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();

const meta: Meta<typeof Chat> = {
  title: "Chat/Chat",
  component: Chat,
  parameters: {
    mockData: [
      {
        url: NEW_SESSION_URL + "?user_id=1",
        method: "GET",
        status: 201,
        response: {
          user_id: nanoid(),
          language: Language.en,
          sessions: [1],
          user_feedback_answered_questions: {},
          sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
          has_sensitive_personal_data: false,
          experiments: {},
        },
      },
      {
        url: getBackendUrl() + "/conversations/:session_id/messages",
        method: "POST",
        status: 201,
        response: {
          messages: [
            {
              message_id: nanoid(),
              message: "I understand you're asking about that. Let me help you with that.",
              sender: "COMPASS",
              sent_at: getTimestamp(3),
              reaction: null,
            },
          ],
          conversation_completed: false,
          conversation_conducted_at: getTimestamp(3),
          experiences_explored: 0,
          current_phase: {
            phase: ConversationPhase.COLLECT_EXPERIENCES,
            percentage: 50,
            current: 2,
            total: 4,
          },
        },
      },
      {
        url: getBackendUrl() + "/conversations/:session_id",
        method: "GET",
        status: 200,
        response: {
          id: 1,
          created_at: getTimestamp(30),
          updated_at: getTimestamp(30),
          status: "active",
          current_phase: {
            phase: ConversationPhase.INTRO,
            percentage: 10,
            current: 1,
            total: 10,
          },
        },
      },
      {
        url: getBackendUrl() + "/conversations/:session_id/messages/:message_id/reactions",
        method: "PUT",
        status: 201,
        response: {
          id: nanoid(),
          message_id: nanoid(),
          session_id: 123,
          created_at: new Date().toISOString(),
        },
      },
      {
        url: getBackendUrl() + "/conversations/:session_id/messages/:message_id/reactions",
        method: "DELETE",
        status: 204,
        response: () => {},
      },
    ],
  },
  decorators: [
    (Story) => {
      // Mock AuthenticationStateService
      const mockService = AuthenticationStateService.getInstance();
      mockService.getUser = () => ({
        id: "1",
        name: "Test User",
        email: "test@example.com",
      });
      return <Story />;
    },
  ],
};

export default meta;

type Story = StoryObj<typeof Chat>;

export const Shown: Story = {
  args: { showInactiveSessionAlert: false, disableInactivityCheck: true },
  parameters: {
    mockData: [
      ...meta.parameters!.mockData,
      {
        url: CONVERSATION_HISTORY_URL,
        method: "GET",
        status: 200,
        response: {
          messages: [
            {
              message_id: "1",
              message: "Hello! How can I help you today?",
              sender: "COMPASS",
              sent_at: getTimestamp(2),
              reaction: null,
            },
            {
              message_id: "2",
              message: "I need help with my CV",
              sender: "USER",
              sent_at: getTimestamp(1),
              reaction: null,
            },
          ],
          conversation_completed: false,
          conversation_conducted_at: getTimestamp(1),
          experiences_explored: 0,
          current_phase: {
            phase: ConversationPhase.INTRO,
            percentage: 10,
            current: 1,
            total: 10,
          },
        },
      },
    ],
  },
};

const generateRealisticConversation = (finished: boolean, includeExperiences: boolean) => {
  const conversationData = [
    {
      url: CONVERSATION_HISTORY_URL,
      method: "GET",
      status: 200,
      response: {
        messages: [
          {
            message_id: "1",
            message: "Welcome! Are you ready to begin your skills exploration session?",
            sender: "COMPASS",
            sent_at: getTimestamp(17),
            reaction: null,
          },
          {
            message_id: "2",
            message: "Yes I am. How do we begin?",
            sender: "USER",
            sent_at: getTimestamp(16),
            reaction: null,
          },
          {
            message_id: "3",
            message:
              "Great! Let's start by talking about your experiences. Tell me about any work or activities you've done in the past. What kind of work have you done?",
            sender: "COMPASS",
            sent_at: getTimestamp(15),
            reaction: null,
          },
          {
            message_id: "4",
            message:
              "I used to help out around my granparent's farm. Just minor chores, like milking the cows and cleaning the horses. That was in rural mozambique, about 4 years ago.",
            sender: "USER",
            sent_at: getTimestamp(14),
            reaction: null,
          },
          {
            message_id: "5",
            message:
              "That's great!  It sounds like you have some valuable experience with farm work. Do you have any other experiences you'd like to talk about?",
            sender: "COMPASS",
            sent_at: getTimestamp(13),
            reaction: null,
          },
          {
            message_id: "6",
            message:
              "Not really. I also have some experience in furniture making, I used to work at a small shop near kenya about a year ago.",
            sender: "USER",
            sent_at: getTimestamp(12),
            reaction: null,
          },
          {
            message_id: "7",
            message:
              "That's great!  It sounds like you have some valuable experience with farm work. Do you have any other experiences you'd like to talk about?\"That's great! It sounds like you have some valuable experience with furniture making. Do you have any other experiences you'd like to talk about?",
            sender: "COMPASS",
            sent_at: getTimestamp(11),
            reaction: null,
          },
          {
            message_id: "8",
            message: "Nope. Nothing springs to mind",
            sender: "USER",
            sent_at: getTimestamp(10),
            reaction: null,
          },
          {
            message_id: "9",
            message:
              "That's great! It sounds like you have some valuable experience. Before I pass you on to my colleague who will help you explore your skills, is there anything else you'd like to add?",
            sender: "COMPASS",
            sent_at: getTimestamp(9),
            reaction: null,
          },
          {
            message_id: "10",
            message: "Nope that sounds good, thanks!",
            sender: "USER",
            sent_at: getTimestamp(8),
            reaction: null,
          },
          {
            message_id: "11",
            message: "Great! Now tell me about your skills. What are you good at? What do you enjoy doing?",
            sender: "COMPASS",
            sent_at: getTimestamp(7),
            reaction: null,
          },
          {
            message_id: "12",
            message: "I'm quite good at playing the ukelele...",
            sender: "USER",
            sent_at: getTimestamp(6),
            reaction: null,
          },
          {
            message_id: "13",
            message:
              "That's great! Tell me more about your ukulele skills. How long have you been playing? What kind of music do you enjoy playing?",
            sender: "COMPASS",
            sent_at: getTimestamp(5),
            reaction: null,
          },
          {
            message_id: "14",
            message:
              "Ive been playing for some 10 years now. I enjoy playing all kinds of music. Traditional western music is my favorite though",
            sender: "USER",
            sent_at: getTimestamp(4),
            reaction: null,
          },
          {
            message_id: "15",
            message:
              "That's interesting! Do you play in any bands or groups? Have you ever performed in front of an audience?",
            sender: "COMPASS",
            sent_at: getTimestamp(3),
            reaction: null,
          },
          {
            message_id: "16",
            message: "Not really. I usually only play in front of family and friends.",
            sender: "USER",
            sent_at: getTimestamp(2),
            reaction: null,
          },
          {
            message_id: "17",
            message:
              "Okay, so you have experience in farming, furniture making, and playing the ukulele. You enjoy playing traditional western music and have been playing for 10 years. You usually only play in front of family and friends. Is there anything else you'd like to add? ",
            sender: "COMPASS",
            sent_at: getTimestamp(1),
            reaction: null,
          },
        ],
        conversation_completed: finished,
        conversation_conducted_at: getTimestamp(1),
        experiences_explored: finished ? 2 : 0,
        current_phase: {
          phase: finished ? ConversationPhase.ENDED : ConversationPhase.COLLECT_EXPERIENCES,
          percentage: finished ? 100 : 50,
          current: finished ? null : 2,
          total: finished ? null : 4,
        },
      },
    },
  ];

  if (includeExperiences) {
    conversationData.push(...meta.parameters!.mockData);
  }

  return conversationData;
};

export const ShownWithUnfinishedConversation: Story = {
  args: { showInactiveSessionAlert: false, disableInactivityCheck: true },
  parameters: {
    mockData: [...meta.parameters!.mockData, ...generateRealisticConversation(false, false)],
    isLoading: true,
  },
};

export const ShownWithFinishedConversation: Story = {
  args: { showInactiveSessionAlert: false, disableInactivityCheck: true },
  parameters: {
    mockData: [...meta.parameters!.mockData, ...generateRealisticConversation(true, true)],
  },
};

export const ShownWhenUserIsInactive: Story = {
  args: {
    showInactiveSessionAlert: true,
    disableInactivityCheck: true,
  },
  parameters: {
    mockData: [...meta.parameters!.mockData, ...generateRealisticConversation(false, true)],
  },
};
