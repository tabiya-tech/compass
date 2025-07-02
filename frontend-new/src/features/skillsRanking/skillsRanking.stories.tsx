import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Meta, StoryObj } from "@storybook/react";

import { useSkillsRanking } from "./useSkillsRanking";
import { IChatMessage } from "src/chat/Chat.types";
import { generateConversationConclusionMessage } from "src/chat/util";
import ChatList from "src/chat/chatList/ChatList";
import { getTestUserPreferences } from "src/_test_utilities/userPreferences";
import { SkillsRankingService } from "./skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import {
  ButtonOrderGroup,
  CompareAgainstGroup,
  SkillRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "./types";
import { nanoid } from "nanoid";

function getMockedSkillsRankingService(experimentGroups: SkillRankingExperimentGroups) {
  const skillsRankingState: Omit<SkillsRankingState, "session_id"> = {
    experiment_groups: experimentGroups,
    phase: SkillsRankingPhase.INITIAL,
    ranking: null,
    self_ranking: null,
  };

  class CustomSkillsRankingService extends SkillsRankingService {
    public constructor() {
      super();
    }

    isSkillsRankingFeatureEnabled() {
      return true;
    }

    async getSkillsRankingState(sessionId: number): Promise<SkillsRankingState> {
      return {
        ...skillsRankingState,
        session_id: sessionId,
        ranking: "50%",
      };
    }

    async updateSkillsRankingState(
      sessionId: number,
      phase: SkillsRankingPhase,
      self_ranking: string
    ): Promise<SkillsRankingState> {
      return {
        ...skillsRankingState,
        session_id: sessionId,
        ranking : "50%",
        phase,
        self_ranking,
      };
    }

    async getRanking(sessionId: number, signal?: AbortSignal) {
      // we have to simulate the internal state change that would happen when the real service calls the API
      this.getSkillsRankingState = async () => (
        {
          ...skillsRankingState,
          session_id: sessionId,
          ranking: "50%",
          phase: SkillsRankingPhase.SELF_EVALUATING,
        }
      )

      return {
        ranking: "50%",
      };
    }
  }

  return new CustomSkillsRankingService();
}

function SkillsRankingDemoComponent(experimentGroups: Readonly<SkillRankingExperimentGroups>) {
  const [messages, setMessages] = useState<IChatMessage<any>[]>([]);

  const addMessage = useCallback((message: IChatMessage<any>) => {
    setMessages((prevMessages) => {
      // if the message already exists, do not add it again
      if (prevMessages.some((msg) => msg.message_id === message.message_id)) {
        return prevMessages;
      }

      return [...prevMessages, message]
    });
  }, []);

  const removeMessage = useCallback((messageId: string) => {
    setMessages((prevMessages) => prevMessages.filter((msg) => msg.message_id !== messageId));
  }, []);

  const skillsRankingService = useMemo(() => getMockedSkillsRankingService(experimentGroups), [experimentGroups]);
  const { showSkillsRanking } = useSkillsRanking(addMessage, removeMessage, skillsRankingService);

  useEffect(() => {
    UserPreferencesStateService.getInstance().setUserPreferences(getTestUserPreferences());
    showSkillsRanking(() => {
      setMessages((prevMessages) => [...prevMessages, generateConversationConclusionMessage(nanoid(), "Last message")]);
    }).then();
  }, [showSkillsRanking]);

  return <ChatList messages={messages} />;
}

const meta: Meta<typeof SkillsRankingDemoComponent> = {
  title: "Features/SkillsRanking",
  component: SkillsRankingDemoComponent,
  argTypes: {
    button_order: {
      control: {
        type: "select",
      },
      options: Object.values(ButtonOrderGroup),
    },
    compare_against: {
      control: {
        type: "select",
      },
      options: Object.values(CompareAgainstGroup),
    },
    delayed_results: {
      control: {
        type: "boolean",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof SkillsRankingDemoComponent>;

export const Shown: Story = {
  args: {
    button_order: ButtonOrderGroup.VIEW_BUTTON_FIRST,
    compare_against: CompareAgainstGroup.AGAINST_JOB_MARKET,
    delayed_results: false
  },
};
