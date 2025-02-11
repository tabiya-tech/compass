import { Meta, StoryObj } from "@storybook/react";
import { ReactionKind } from "src/chat/reaction/reaction.types";
import ReactionButtons from "src/chat/reaction/components/reactionButtons/ReactionButtons";
import { getBackendUrl } from "src/envService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { nanoid } from "nanoid";

const meta: Meta<typeof ReactionButtons> = {
  title: "feedback/Reaction/ReactionButtons",
  component: ReactionButtons,
  tags: ["autodocs"],
  args: {
    messageId: "001",
  },
  parameters: {
    mockData: {
      UserPreferencesStateService: {
        getInstance: () => ({
          getActiveSessionId: () => 1234,
        }),
      },
    },
  },
  decorators: [
    (Story) => {
      UserPreferencesStateService.getInstance().getActiveSessionId = () => 1234;
      return Story();
    },
  ],
};

export default meta;

type Story = StoryObj<typeof ReactionButtons>;

const mockData = (status: number, deleteStatus: number, delay: number = 0) => [
  {
    url: getBackendUrl() + "/conversations/:session_id/messages/:message_id/reactions",
    method: "PUT",
    status: status,
    response: {},
    delay: delay,
  },
  {
    url: getBackendUrl() + "/conversations/:session_id/messages/:message_id/reactions",
    method: "DELETE",
    status: deleteStatus,
    response: () => {},
    delay: delay,
  },
];

export const Shown: Story = {
  args: {},
  parameters: {
    mockData: mockData(201, 204),
  },
};

export const ShownWithLikeReaction: Story = {
  args: {
    currentReaction: {
      id: nanoid(),
      kind: ReactionKind.LIKED,
    },
  },
  parameters: {
    mockData: mockData(200, 204),
  },
};

export const ShownWithDislikeReaction: Story = {
  args: {
    currentReaction: {
      id: nanoid(),
      kind: ReactionKind.DISLIKED,
    },
  },
  parameters: {
    mockData: mockData(200, 204),
  },
};

export const ReactionRemoveFailure: Story = {
  args: {},
  parameters: {
    mockData: mockData(200, 500),
  },
};

export const FailingReactionSubmission: Story = {
  args: {},
  parameters: {
    mockData: mockData(500, 500, 1000),
  },
};
