import React from "react";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { Box } from "@mui/material";
import { Navigate, Route, Routes } from "react-router-dom";

import CareerReadinessModule from "src/careerReadiness/pages/CareerReadinessModule/CareerReadinessModule";
import CareerReadinessService from "src/careerReadiness/services/CareerReadinessService";
import { routerPaths } from "src/app/routerPaths";
import type { CareerReadinessConversationResponse, ModuleDetail } from "src/careerReadiness/types";

// ROUTE SETUP
const DEFAULT_MODULE_ID = "mock-module-readiness";
const MODULE_ROUTE = `${routerPaths.CAREER_READINESS}/${DEFAULT_MODULE_ID}`;

globalThis.location.hash = `#${MODULE_ROUTE}`;

const withModuleRoute: Decorator = (Story) => (
  <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
    <Routes>
      <Route path={routerPaths.ROOT} element={<Navigate to={MODULE_ROUTE} replace />} />
      <Route path={routerPaths.CAREER_READINESS} element={<Navigate to={MODULE_ROUTE} replace />} />
      <Route path={`${routerPaths.CAREER_READINESS}/:moduleId`} element={<Story />} />
      <Route path="*" element={<Navigate to={MODULE_ROUTE} replace />} />
    </Routes>
  </Box>
);

// MOCK SERVICE
const createServiceMock =
  (overrides: Partial<any>): Decorator =>
  (Story) => {
    const service = CareerReadinessService.getInstance() as any;
    Object.assign(service, overrides);
    return <Story />;
  };

// MOCK DATA
const getTimestamp = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();

const moduleDetailBase: ModuleDetail = {
  id: DEFAULT_MODULE_ID,
  title: "Workplace Readiness",
  description: "Learn workplace communication and expectations.",
  icon: "workplace",
  status: "NOT_STARTED",
  sort_order: 4,
  input_placeholder: "Ask about workplace readiness...",
  scope: "Workplace communication and collaboration",
  active_conversation_id: null,
  topics: [],
};

const newConversationResponse: CareerReadinessConversationResponse = {
  conversation_id: "conv-new",
  module_id: DEFAULT_MODULE_ID,
  module_completed: false,
  messages: [
    {
      message_id: "intro-1",
      message: "Hi! Ready to build workplace readiness skills?",
      sent_at: getTimestamp(0),
      sender: "AGENT",
    },
  ],
};

const historyResponse: CareerReadinessConversationResponse = {
  conversation_id: "conv-1",
  module_id: DEFAULT_MODULE_ID,
  module_completed: false,
  messages: [
    {
      message_id: "m1",
      message: "Welcome! Let's explore workplace readiness together.",
      sent_at: getTimestamp(5),
      sender: "AGENT",
    },
    {
      message_id: "m2",
      message: "What should I focus on first?",
      sent_at: getTimestamp(3),
      sender: "USER",
    },
    {
      message_id: "m3",
      message: "Start with communication, teamwork, and professionalism.",
      sent_at: getTimestamp(0),
      sender: "AGENT",
    },
  ],
};

const completedHistoryResponse: CareerReadinessConversationResponse = {
  conversation_id: "conv-completed",
  module_id: DEFAULT_MODULE_ID,
  module_completed: true,
  messages: [
    {
      message_id: "c1",
      message: "Welcome! Let's explore workplace readiness together.",
      sent_at: getTimestamp(10),
      sender: "AGENT",
    },
    {
      message_id: "c2",
      message: "I'd like to learn about communication.",
      sent_at: getTimestamp(8),
      sender: "USER",
    },
    {
      message_id: "c3",
      message: "Great. Here are a few quiz questions to check your understanding.",
      sent_at: getTimestamp(5),
      sender: "AGENT",
    },
    {
      message_id: "c4",
      message:
        "Well done! You've passed the quiz for this module. You can continue to ask me follow-up questions here.",
      sent_at: getTimestamp(0),
      sender: "AGENT",
    },
  ],
};

// META
const meta: Meta<typeof CareerReadinessModule> = {
  title: "CareerReadiness/CareerReadinessModule",
  component: CareerReadinessModule,
  tags: ["autodocs"],
  decorators: [withModuleRoute],
};

export default meta;

type Story = StoryObj<typeof CareerReadinessModule>;

// STORIES
export const ExistingConversation: Story = {
  decorators: [
    createServiceMock({
      getModule: async () => ({
        ...moduleDetailBase,
        active_conversation_id: "conv-1",
        status: "IN_PROGRESS",
      }),
      createConversation: async () => {
        throw new Error("Should not be called");
      },
      getConversationHistory: async () => historyResponse,
      sendMessage: async (_m: string, _c: string, userInput: string) => ({
        ...historyResponse,
        messages: [
          ...historyResponse.messages,
          {
            message_id: "u-new",
            message: userInput,
            sent_at: getTimestamp(0),
            sender: "USER",
          },
          {
            message_id: "a-new",
            message: "Great question. Let's break that down.",
            sent_at: getTimestamp(0),
            sender: "AGENT",
          },
        ],
      }),
    }),
  ],
};

export const NewConversation: Story = {
  decorators: [
    createServiceMock({
      getModule: async () => ({
        ...moduleDetailBase,
        active_conversation_id: null,
        topics: [],
      }),
      createConversation: async () => newConversationResponse,
      // getConversationHistory: async () => newConversationResponse,
    }),
  ],
};

export const Loading: Story = {
  decorators: [
    createServiceMock({
      getModule: async () => {
        await new Promise((r) => setTimeout(r, 1200));
        return {
          ...moduleDetailBase,
          active_conversation_id: "conv-1",
          status: "IN_PROGRESS",
        };
      },
    }),
  ],
};

export const ModuleCompleted: Story = {
  decorators: [
    createServiceMock({
      getModule: async () => ({
        ...moduleDetailBase,
        active_conversation_id: "conv-completed",
        status: "COMPLETED",
      }),
      createConversation: async () => {
        throw new Error("Should not be called");
      },
      getConversationHistory: async () => completedHistoryResponse,
      sendMessage: async () => completedHistoryResponse,
    }),
  ],
};
