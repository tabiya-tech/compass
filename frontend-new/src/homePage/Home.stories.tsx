import type { Meta, StoryObj } from "@storybook/react";
import Home from "./Home";
import { getBackendUrl } from "src/envService";

const meta: Meta<typeof Home> = {
  title: "Application/Home",
  component: Home,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof Home>;

const CONVERSATION_HISTORY_URL = getBackendUrl() + "/conversation/history?session_id=1234";

export const Shown: Story = {
  args: {},
  parameters: {
    mockData: [
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
