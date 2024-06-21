import type { Meta, StoryObj } from "@storybook/react";
import Chat from "./Chat";
import { getBackendUrl } from "../envService";

const meta: Meta<typeof Chat> = {
  title: "Chat/Chat-Component",
  component: Chat,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof Chat>;

const CONVERSATION_URL = getBackendUrl() + "/conversation";

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
        },
      },
    ],
  },
};
