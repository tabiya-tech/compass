export interface LLMStats {
  error: string;
  prompt_token_count: number;
  response_token_count: number;
  response_time_in_sec: number;
}

export interface AgentOutput {
  message_for_user: string;
  finished: boolean;
  agent_type: string;
  reasoning: string;
  agent_response_time_in_sec: number;
  llm_stats: LLMStats[];
}

export interface Turn {
  index: number;
  input: {
    message: string;
  };
  output: AgentOutput;
}

export interface ConversationHistory {
  turns: Turn[];
}

export interface ConversationContext {
  all_history: ConversationHistory;
  history: ConversationHistory;
  summary: string;
}

export interface LastMessage {
  message_for_user: string;
  finished: boolean;
  agent_type: string;
  reasoning: string;
  agent_response_time_in_sec: number;
  llm_stats: LLMStats[];
}

export interface RootObject {
  last: LastMessage;
  conversation_context: ConversationContext;
}

export type INewChatSpecification = {
  user_id: string;
};

export type IMessageSpecification = {
  user_id: string;
  message: string;
};
