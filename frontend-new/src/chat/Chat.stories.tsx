import type { Meta, StoryObj } from "@storybook/react";
import Chat from "./Chat";
import { getBackendUrl } from "src/envService";
import { mockExperiences } from "src/experiences/experiencesDrawer/experienceService/_test_utilities/mockExperiencesResponses";

const meta: Meta<typeof Chat> = {
  title: "Chat/Chat-Component",
  component: Chat,
  tags: ["autodocs"],
  argTypes: {},
  parameters: {
    mockData: [
      {
        url: getBackendUrl() + "/conversation/experiences?session_id=1234",
        method: "GET",
        status: 200,
        response: mockExperiences,
      },
    ],
  },
};

export default meta;

type Story = StoryObj<typeof Chat>;

const CONVERSATION_HISTORY_URL = getBackendUrl() + "/conversation/history?session_id=1234";

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
              message: "Hello! How can I help you today?",
              sender: "COMPASS",
              sent_at: "2021-10-01T12:00:01Z",
            },
            {
              message: "I need help with my CV",
              sender: "USER",
              sent_at: "2021-10-01T12:00:02Z",
            },
          ],
          conversation_completed: false,
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
            message: "Welcome! Are you ready to begin your skills exploration session?",
            sender: "COMPASS",
            sent_at: "2021-10-01T12:00:01Z",
          },
          {
            message: "Yes I am. How do we begin?",
            sender: "USER",
            sent_at: "2021-10-01T12:00:02Z",
          },
          {
            message:
              "Great! Let's start by talking about your experiences. Tell me about any work or activities you've done in the past. What kind of work have you done?",
            sender: "COMPASS",
            sent_at: "2021-10-01T12:00:03Z",
          },
          {
            message:
              "I used to help out around my granparent's farm. Just minor chores, like milking the cows and cleaning the horses. That was in rural mozambique, about 4 years ago.",
            sender: "USER",
            sent_at: "2021-10-01T12:00:04Z",
          },
          {
            message:
              "That's great!  It sounds like you have some valuable experience with farm work. Do you have any other experiences you'd like to talk about?",
            sender: "COMPASS",
            sent_at: "2021-10-01T12:00:04Z",
          },
          {
            message:
              "Not really. I also have some experience in furniture making, I used to work at a small shop near kenya about a year ago.",
            sender: "USER",
            sent_at: "2021-10-01T12:00:05Z",
          },
          {
            message:
              "That's great!  It sounds like you have some valuable experience with farm work. Do you have any other experiences you'd like to talk about?\"That's great! It sounds like you have some valuable experience with furniture making. Do you have any other experiences you'd like to talk about?",
            sender: "COMPASS",
            sent_at: "2021-10-01T12:00:06Z",
          },
          {
            message: "Nope. Nothing springs to mind",
            sender: "USER",
            sent_at: "2021-10-01T12:00:07Z",
          },
          {
            message:
              "That's great! It sounds like you have some valuable experience. Before I pass you on to my colleague who will help you explore your skills, is there anything else you'd like to add?",
            sender: "COMPASS",
            sent_at: "2021-10-01T12:00:08Z",
          },
          {
            message: "Nope that sounds good, thanks!",
            sender: "USER",
            sent_at: "2021-10-01T12:00:09Z",
          },
          {
            message: "Great! Now tell me about your skills. What are you good at? What do you enjoy doing?",
            sender: "COMPASS",
            sent_at: "2021-10-01T12:00:10Z",
          },
          {
            message: "I'm quite good at playing the ukelele...",
            sender: "USER",
            sent_at: "2021-10-01T12:00:11Z",
          },
          {
            message:
              "That's great! Tell me more about your ukulele skills. How long have you been playing? What kind of music do you enjoy playing?",
            sender: "COMPASS",
            sent_at: "2021-10-01T12:00:12Z",
          },
          {
            message:
              "Ive been playing for some 10 years now. I enjoy playing all kinds of music. Traditional western music is my favorite though",
            sender: "USER",
            sent_at: "2021-10-01T12:00:13Z",
          },
          {
            message:
              "That's interesting! Do you play in any bands or groups? Have you ever performed in front of an audience?",
            sender: "COMPASS",
            sent_at: "2021-10-01T12:00:14Z",
          },
          {
            message: "Not really. I usually only play in front of family and friends.",
            sender: "USER",
            sent_at: "2021-10-01T12:00:15Z",
          },
          {
            message:
              "Okay, so you have experience in farming, furniture making, and playing the ukulele. You enjoy playing traditional western music and have been playing for 10 years. You usually only play in front of family and friends. Is there anything else you'd like to add? ",
            sender: "COMPASS",
            sent_at: "2021-10-01T12:00:16Z",
          },
        ],
        conversation_completed: finished,
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
    mockData: generateRealisticConversation(false, false),
    isLoading: true,
  },
};

export const ShownWithFinishedConversation: Story = {
  args: { showInactiveSessionAlert: false, disableInactivityCheck: true },
  parameters: {
    mockData: generateRealisticConversation(true, true),
  },
};

export const ShownWhenUserIsInactive: Story = {
  args: {
    showInactiveSessionAlert: true,
    disableInactivityCheck: true,
  },
  parameters: {
    mockData: generateRealisticConversation(false, true),
  },
};
