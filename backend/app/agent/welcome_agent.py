import logging
import time

from textwrap import dedent
from typing import Mapping, Any

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

from app.agent.agent import Agent
from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template.agent_prompt_template import STD_LANGUAGE_STYLE, STD_AGENT_CHARACTER
from app.agent.prompt_template.format_prompt import replace_placeholders_with_indent
from app.agent.agent_types import AgentType, AgentOutput, LLMStats, AgentInput
from app.agent.simple_llm_agent.prompt_response_template import get_json_examples_instructions
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.conversation_memory.conversation_memory_types import ConversationContext
from app.countries import Country
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import get_config_variation, LLMConfig, JSON_GENERATION_CONFIG
from app.i18n.translation_service import t
from common_libs.retry import Retry


class WelcomeAgentState(BaseModel):
    """
    The state of the welcome agent
    """
    session_id: int
    """
    The session id of the conversation
    """

    is_first_encounter: bool = True
    """
    Whether this is the first encounter with the user.
    """

    user_started_discovery: bool = False
    """
    Whether the user has started the discovery/exploration session.
    """

    country_of_user: Country = Field(default=Country.UNSPECIFIED)
    """
    The country of the user.
    """

    @field_serializer("country_of_user")
    def serialize_country_of_user(self, country_of_user: Country, _info):
        return country_of_user.name

    @field_validator("country_of_user", mode='before')
    def deserialize_country_of_user(cls, value: str | Country) -> Country:
        if isinstance(value, str):
            return Country[value]
        return value

    @staticmethod
    def from_document(_doc: Mapping[str, Any]) -> "WelcomeAgentState":
        return WelcomeAgentState(session_id=_doc["session_id"],
                                 is_first_encounter=_doc["is_first_encounter"],
                                 user_started_discovery=_doc["user_started_discovery"],
                                 country_of_user=_doc.get("country_of_user", Country.UNSPECIFIED))


class WelcomeAgentLLMResponse(BaseModel):
    reasoning: str
    """Chain of Thought reasoning behind the response of the LLM"""

    user_indicated_start: bool
    """Flag indicating whether the user has indicated that they are ready to start the skills discovery/exploration session"""

    message: str
    """Message for the user that the LLM produces"""

    model_config = ConfigDict(extra="forbid")


class WelcomeAgentLLMResponseWithLLMStats(WelcomeAgentLLMResponse):
    llm_stats: list[LLMStats]
    """The stats for the LLM call"""


class WelcomeAgent(Agent):
    """
    Agent that welcomes the user and forwards them to the skill-discovery and -exploration session.
    Additionally, it answers any questions the user might have around Compass and the process.
    If the user returns to the welcome agent after starting the skill-discovery and -exploration session,
    it will not start over but only answer any questions the user might have.
    """

    def __init__(self):
        super().__init__(
            agent_type=AgentType.WELCOME_AGENT,
            is_responsible_for_conversation_history=False,
        )
        self._state: WelcomeAgentState | None = None

    def set_state(self, state: WelcomeAgentState):
        """
        Set the state of the agent
        :param state: The state to set
        """
        self._state = state

    async def execute(self, user_input: AgentInput, context: ConversationContext, locale: str = "en") -> AgentOutput:
        """
        Execute the agent
        :param user_input: The user input
        :param context: The conversation context
        :param locale: The locale of the user
        :return: The agent output
        """
        agent_start_time = time.time()

        if self._state is None:
            raise ValueError("WelcomeAgent: execute() called before state was initialized")

        if user_input.message.strip() == "":
            # If the user input is empty, set it to "(silence)"
            # This is to avoid the agent failing to respond to an empty input
            user_input.message = "(silence)"
            user_input.is_artificial = True
        user_msg = user_input.message.strip()  # Remove leading and trailing whitespaces

        if self._state.is_first_encounter:
            self._state.is_first_encounter = False
            return AgentOutput(
                message_for_user=await WelcomeAgent.get_first_encounter_message(locale),
                finished=False,
                agent_type=self.agent_type,
                agent_response_time_in_sec=round(time.time() - agent_start_time, 2),
                llm_stats=[]
            )

        llm_stats: list[LLMStats] = []

        llm_caller: LLMCaller[WelcomeAgentLLMResponse] = LLMCaller[WelcomeAgentLLMResponse](model_response_type=WelcomeAgentLLMResponse)

        async def _callback(attempt: int, max_retries: int) -> tuple[WelcomeAgentLLMResponseWithLLMStats, float, BaseException | None]:
            # Call the LLM to get the next message for the user
            # Add some temperature and top_p variation to prompt the LLM to return different results on each retry.
            # Exponentially increase the temperature and top_p to avoid the LLM returning the same result every time.
            temperature_config = get_config_variation(start_temperature=0.25, end_temperature=0.5,
                                                      start_top_p=0.8, end_top_p=1,
                                                      attempt=attempt, max_retries=max_retries)
            self._logger.debug("Calling WelcomeAgent with temperature: %s, top_p: %s",
                               temperature_config["temperature"],
                               temperature_config["top_p"])
            _response, _penalty, _error = await WelcomeAgent._internal_execute(
                temperature_config=temperature_config,
                llm_caller=llm_caller,
                logger=self._logger,
                state=self._state,
                user_input=user_msg,
                context=context,
                locale=locale
            )
            # Aggregate the LLM stats
            llm_stats.extend(_response.llm_stats)
            return _response, _penalty, _error
        response, _, _ = await Retry[WelcomeAgentLLMResponseWithLLMStats].call_with_penalty(callback=_callback, logger=self._logger)
        if not self._state.user_started_discovery:
            # Set the value only the very first time, the user indicates that they are ready to start
            # After that, the agent will be executed only to answer questions and not to start the skill discovery/exploration session
            self._state.user_started_discovery = response.user_indicated_start

        return AgentOutput(
            message_for_user=response.message,
            finished=response.user_indicated_start,
            agent_type=self.agent_type,
            agent_response_time_in_sec=round(time.time() - agent_start_time, 2),
            llm_stats=llm_stats
        )

    @staticmethod
    async def _internal_execute(*,
                                llm_caller: LLMCaller[WelcomeAgentLLMResponse],
                                temperature_config: dict,
                                user_input: str,
                                context: ConversationContext,
                                state: WelcomeAgentState,
                                logger: logging.Logger,
                                locale: str) -> tuple[WelcomeAgentLLMResponseWithLLMStats, float, BaseException | None]:

        model_response: WelcomeAgentLLMResponse | None
        llm_stats_list: list[LLMStats]

        llm = GeminiGenerativeLLM(
            system_instructions=WelcomeAgent.get_system_instructions(state, locale),
            config=LLMConfig(
                generation_config=temperature_config | JSON_GENERATION_CONFIG,
            )
        )
        # Call the LLM to get the next message for the user, this will never
        model_response, llm_stats_list = await llm_caller.call_llm(
            llm=llm,
            llm_input=ConversationHistoryFormatter.format_for_agent_generative_prompt(
                model_response_instructions=WelcomeAgent.get_json_response_instructions(state, locale),
                context=context,
                user_input=user_input),
            logger=logger
        )

        # If it was not possible to get a model response, set the response to a default message
        if model_response is None or model_response.message.strip() == "":
            return (WelcomeAgentLLMResponseWithLLMStats(
                reasoning=t("prompts", "welcome_agent_empty_response_reasoning", locale),
                message=t("prompts", "welcome_agent_empty_response_message", locale),
                user_indicated_start=False,
                llm_stats=llm_stats_list),
                    100, ValueError(t("prompts", "welcome_agent_empty_response_error", locale)))

        return WelcomeAgentLLMResponseWithLLMStats(
            reasoning=model_response.reasoning,
            message=model_response.message.strip('"'),
            user_indicated_start=model_response.user_indicated_start,
            llm_stats=llm_stats_list
        ), 0, None

    @staticmethod
    async def get_first_encounter_message(locale: str):
        return t("prompts", "welcome_agent_first_encounter", locale)

    @staticmethod
    def get_system_instructions(state: WelcomeAgentState, locale: str) -> str:
        """
        Get the system instructions of the agent
        :return: The system instructions
        """

        system_instructions_template = t("prompts", "welcome_agent_system_instructions", locale)
        system_instructions = replace_placeholders_with_indent(system_instructions_template,
                                                               language_style=STD_LANGUAGE_STYLE,
                                                               agent_character=STD_AGENT_CHARACTER,
                                                               json_response_instructions=WelcomeAgent.get_json_response_instructions(state, locale))
        return system_instructions

    @staticmethod
    def get_json_response_instructions(state: WelcomeAgentState, locale: str) -> str:

        """
        Get the instructions so that the model can return a JSON. This can be added to the prompt.
        :return: A string with the instructions for the model to return a JSON.
        """
        # Define the response part of the prompt with some example responses
        few_shot_examples = []
        if not state.user_started_discovery:
            few_shot_examples.append(WelcomeAgentLLMResponse(
                reasoning=t("prompts", "welcome_agent_json_reasoning_no_start", locale),
                user_indicated_start=False,
                message=t("prompts", "welcome_agent_json_message_my_name", locale),
            ))
            few_shot_examples.append(WelcomeAgentLLMResponse(
                reasoning=t("prompts", "welcome_agent_json_reasoning_do_start", locale),
                user_indicated_start=True,
                message=t("prompts", "welcome_agent_json_message_do_start", locale),
            ))

        few_shot_examples.append(WelcomeAgentLLMResponse(
            reasoning=t("prompts", "welcome_agent_json_reasoning_can_answer", locale),
            user_indicated_start=False,
            message="...",
        ))

        few_shot_examples_instructions = get_json_examples_instructions(
            examples=few_shot_examples
        )
        instructions = t("prompts", "welcome_agent_json_response_instructions", locale)
        return replace_placeholders_with_indent(
            instructions,
            few_shot_examples_instructions=few_shot_examples_instructions
        )
