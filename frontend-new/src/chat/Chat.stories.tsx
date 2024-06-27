import type { Meta, StoryObj } from "@storybook/react";
import Chat, { START_PROMPT } from "./Chat";
import { getBackendUrl } from "src/envService";

const meta: Meta<typeof Chat> = {
  title: "Chat/Chat-Component",
  component: Chat,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof Chat>;

const CONVERSATION_URL = getBackendUrl() + "/conversation?user_input=~~~START_CONVERSATION~~~&session_id=1234";

export const Shown: Story = {
  args: {},
  parameters: {
    mockData: [
      {
        url: CONVERSATION_URL,
        method: "GET",
        status: 200,
        response: {
          last: {
            message_for_user: "Hello, how can I help you?",
          },
          conversation_context: {
            all_history: {
              turns: [
                {
                  input: { message: "Hello" },
                  output: { message_for_user: "Hello, I'm Compass" },
                },
              ],
            },
          },
        },
      },
    ],
  },
};

export const ShownWithRealisticConversation: Story = {
  args: {},
  parameters: {
    mockData: [
      {
        url: CONVERSATION_URL,
        method: "GET",
        status: 200,
        response: {
          last: {
            message_for_user: "Hello, how can I help you?",
          },
          conversation_context: {
            all_history: {
              turns: [
                {
                  input: { message: START_PROMPT },
                  output: { message_for_user: "Welcome! Are you ready to begin your skills exploration session?" },
                },
                {
                  input: { message: "Yes I am. How do we begin?" },
                  output: {
                    message_for_user:
                      "Great! To start, tell me about your first work experience. What was the position, and when and where did you work?",
                  },
                },
                {
                  input: {
                    message:
                      "I used to help out around my granparent's farm. Just minor chores, like milking the cows and cleaning the horses. That was in rural mozambique, about 4 years ago.",
                  },
                  output: {
                    message_for_user:
                      "That's great!  It sounds like you have some valuable experience with farm work. Do you have any other experiences you'd like to talk about?",
                  },
                },
                {
                  input: {
                    message:
                      "Not really. I also have some experience in furniture making, I used to work at a small shop near kenya about a year ago.",
                  },
                  output: {
                    message_for_user:
                      "That's great!  It sounds like you have some valuable experience with farm work. Do you have any other experiences you'd like to talk about?\"That's great! It sounds like you have some valuable experience with furniture making. Do you have any other experiences you'd like to talk about?",
                  },
                },
                {
                  input: { message: "Nope. Nothing springs to mind" },
                  output: {
                    message_for_user:
                      "That's great! It sounds like you have some valuable experience. Before I pass you on to my colleague who will help you explore your skills, is there anything else you'd like to add?",
                  },
                },
                {
                  input: { message: "Nope that sounds good, thanks!" },
                  output: {
                    message_for_user:
                      "Great! Now, tell me about your skills. What are you good at? What do you enjoy doing?",
                  },
                },
                {
                  input: { message: "I'm quite good at playing the ukelele..." },
                  output: {
                    message_for_user:
                      "That's great! Tell me more about your ukulele skills. How long have you been playing? What kind of music do you enjoy playing?",
                  },
                },
                {
                  input: {
                    message:
                      "Ive been playing for some 10 years now. I enjoy playing all kinds of music. Traditional western music is my favorite though",
                  },
                  output: {
                    message_for_user:
                      "That's interesting! Do you play in any bands or groups? Have you ever performed in front of an audience?",
                  },
                },
                {
                  input: { message: "Not really. I usually only play in front of family and friends." },
                  output: {
                    message_for_user:
                      "That's interesting! Do you play in any bands or groups? Have you ever performed in front of an audience?",
                  },
                },
                {
                  input: {
                    message:
                      "Okay, so you have experience in farming, furniture making, and playing the ukulele. You enjoy playing traditional western music and have been playing for 10 years. You usually only play in front of family and friends. Is there anything else you'd like to add? ",
                  },
                  output: {
                    message_for_user:
                      "That's interesting! Do you play in any bands or groups? Have you ever performed in front of an audience?",
                  },
                },
                {
                  input: { message: "No that's all" },
                  output: { message_for_user: "Conversation finished, nothing to do!" },
                },
              ],
            },
          },
        },
      },
    ],
  },
};
