import time

from app.agent.agent import Agent
from app.agent.agent_types import AgentInput, AgentOutput, AgentType, LLMStats, AgentOutputWithReasoning
from app.agent.llm_caller import LLMCaller
from app.agent.simple_llm_agent.llm_response import ModelResponse
from app.agent.simple_llm_agent.prompt_response_template import get_json_response_instructions
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter

from app.conversation_memory.conversation_memory_manager import ConversationContext
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, LOW_TEMPERATURE_GENERATION_CONFIG, JSON_GENERATION_CONFIG


class SimpleLLMAgent(Agent):
    """
    This is a simple stateless agent that uses the GeminiGenerativeLLM to respond to the user input in a conversation.
    """

    def __init__(self, *,
                 agent_type: AgentType,
                 system_instructions: str,
                 config: LLMConfig = LLMConfig(
                     generation_config=LOW_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG)):
        super().__init__(agent_type=agent_type, is_responsible_for_conversation_history=False)
        self._llm_config = config
        self._system_instructions = system_instructions
        # We should pass the system instructions to the LLM
        # Passing the system instructions as a user part manually in the content,
        # does not seem to work well with the model as it does follow the instructions correctly.
        self._llm = GeminiGenerativeLLM(system_instructions=system_instructions, config=config)
        self._llm_caller: LLMCaller[ModelResponse] = LLMCaller[ModelResponse](model_response_type=ModelResponse)

    async def execute(self, user_input: AgentInput, context: ConversationContext) -> AgentOutput:
        agent_start_time = time.time()
        if user_input.message == "":
            # If the user input is empty, set it to "(silence)"
            # This is to avoid the agent failing to respond to an empty input
            user_input.message = "(silence)"
            user_input.is_artificial = True
        msg = user_input.message.strip()  # Remove leading and trailing whitespaces
        model_response: ModelResponse | None
        llm_stats_list: list[LLMStats]

        try:
            model_response, llm_stats_list = await self._llm_caller.call_llm(
                llm=self._llm,
                llm_input=ConversationHistoryFormatter.format_for_agent_generative_prompt(
                    model_response_instructions=get_json_response_instructions(),
                    context=context, user_input=msg),
                logger=self.logger
            )
        except Exception as e:
            self.logger.exception("An error occurred while calling the LLM.", e)
            model_response = None
            llm_stats_list = []

        # If it was not possible to get a model response, set the response to a default message
        if model_response is None:
            model_response = ModelResponse(
                reasoning="Failed to get a response",
                message="I am facing some difficulties right now, could you please repeat what you said?",
                finished=False)

        agent_end_time = time.time()
        response = AgentOutputWithReasoning(
            message_for_user=model_response.message.strip('"'),
            finished=model_response.finished,
            reasoning=model_response.reasoning,
            agent_type=self.agent_type,
            agent_response_time_in_sec=round(agent_end_time - agent_start_time, 2),
            llm_stats=llm_stats_list)
        return response
