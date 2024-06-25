import { LastMessage, RootObject } from "src/chat/ChatService/ChatService.types";

export const generateRootObjectResponse = (): RootObject => ({
  last: {
    message_for_user: "Hello",
    finished: false,
    agent_type: "WelcomeAgent",
    reasoning: "Initial greeting",
    agent_response_time_in_sec: 1.0,
    llm_stats: [
      {
        error: "",
        prompt_token_count: 50,
        response_token_count: 10,
        response_time_in_sec: 1.0,
      },
    ],
  },
  conversation_context: {
    all_history: {
      turns: [
        {
          index: 1,
          input: {
            message: "Hello",
          },
          output: {
            message_for_user: "Hi there!",
            finished: false,
            agent_type: "WelcomeAgent",
            reasoning: "Greeting response",
            agent_response_time_in_sec: 0.5,
            llm_stats: [
              {
                error: "",
                prompt_token_count: 30,
                response_token_count: 10,
                response_time_in_sec: 0.5,
              },
            ],
          },
        },
      ],
    },
    history: {
      turns: [],
    },
    summary: "",
  },
});

export const generateLastMessageResponse = (): LastMessage => ({
  message_for_user: "Hi there!",
  finished: false,
  agent_type: "WelcomeAgent",
  reasoning: "Greeting response",
  agent_response_time_in_sec: 1.0,
  llm_stats: [
    {
      error: "",
      prompt_token_count: 30,
      response_token_count: 10,
      response_time_in_sec: 0.5,
    },
  ],
});
