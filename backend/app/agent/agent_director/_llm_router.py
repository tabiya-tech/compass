from logging import Logger
from textwrap import dedent

from pydantic import BaseModel

from app.agent.agent_director.abstract_agent_director import ConversationPhase

from app.agent.agent_types import AgentType, AgentInput
from app.agent.llm_caller import LLMCaller
from app.agent.penalty import get_penalty
from app.agent.prompt_template.format_prompt import replace_placeholders_with_indent
from app.conversation_memory.conversation_memory_types import ConversationContext
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import get_config_variation, LLMConfig, JSON_GENERATION_CONFIG
from common_libs.retry import Retry

DEFAULT_AGENT = "DefaultAgent"
HISTORY_LENGTH = 5


class RouterModelResponse(BaseModel):
    """
    The response from the router model

    The oder of the properties is important.
    Order the output components strategically to improve model predictions:
    1. Reasoning: Place this first, as it sets the context for the response.
    2. agent_type: Conclude with the agent type, which relies on the reasoning.
    This ordering leverages semantic dependencies to enhance accuracy in prediction.
    """
    reasoning: str
    """Chain of Thought reasoning behind the response of the LLM"""
    agent_type: str
    """The agent type that is most suitable for handling the user input"""


class AgentTasking(BaseModel):
    """
    The tasks that the agent is responsible for
    """
    agent_type_name: str

    """
    LLM-targeted text description of the tasks that this agent can handle.
    """
    tasks: str

    """
    Examples of user input
    """
    examples: list[str]


class LLMRouter:
    """
    The LLM Router is responsible for routing the user input to the most suitable agent type based on the user input
    and the current conversation phase.
    """

    def __init__(self, logger: Logger):
        # initialize the router model
        self._llm_caller: LLMCaller[RouterModelResponse] = LLMCaller[RouterModelResponse](model_response_type=RouterModelResponse)
        self._logger = logger
        # define the tasks that each agent is responsible for
        welcome_agent_tasks = AgentTasking(
            agent_type_name=AgentType.WELCOME_AGENT.value,
            tasks="Welcomes the user and answers any questions "
                  "regarding the process and the tool.",
            examples=["How does the counseling process work?"]
        )
        experiences_explorer_agent_tasks = AgentTasking(
            agent_type_name=AgentType.EXPLORE_EXPERIENCES_AGENT.value,
            tasks="Explore and verify the users skills and work experiences.",
            examples=["I worked as a software developer for 5 years.",
                      "I am ready to explore my skills."]
        )
        farewell_agent_tasks = AgentTasking(
            agent_type_name=AgentType.FAREWELL_AGENT.value,
            tasks="Ends the conversation with the user.",
            examples=["I want to finish the conversation."]
        )
        default_agent_tasks = AgentTasking(
            agent_type_name=DEFAULT_AGENT,
            tasks="Handles all other queries that do not fall under the purview "
                  "of the other agents, or when it is not clear "
                  "which agent is most suitable.",
            examples=[]
        )
        # Define the tasks for each phase
        self._agent_tasking_for_phase: dict[ConversationPhase, list[AgentTasking]] = {
            ConversationPhase.INTRO: [welcome_agent_tasks, default_agent_tasks],
            ConversationPhase.COUNSELING: [welcome_agent_tasks, experiences_explorer_agent_tasks, default_agent_tasks],
            ConversationPhase.CHECKOUT: [farewell_agent_tasks, default_agent_tasks]
        }
        # The default agent for each phase, if the model fails to respond or returns an invalid agent type,
        # or if the model returns the "default agent" because it cannot classify the user input.
        self._default_agent_for_phase = {
            ConversationPhase.INTRO: AgentType.WELCOME_AGENT,
            ConversationPhase.COUNSELING: AgentType.EXPLORE_EXPERIENCES_AGENT,
            ConversationPhase.CHECKOUT: AgentType.FAREWELL_AGENT
        }

    # TODO: the method should return the LLM stats so that the agent director can aggregate them
    async def execute(self, *,
                      user_input: AgentInput,
                      phase: ConversationPhase,
                      context: ConversationContext
                      ) -> AgentType:
        """
        Get the agent type most suitable to handle the user input
        based on the user input, and the current conversation phase.

        :param user_input: The user input to be routed to the most suitable agent type.
        :param phase: The current conversation phase.
        :param context: The conversation context, which contains the conversation history.
        :return: The agent type that is most suitable for handling the user input, penalty and error
        """

        async def _callback(attempt: int, max_retries: int) -> tuple[AgentType, float, BaseException | None]:
            # Call the LLM to get the suitable agent type.

            # Add some temperature and `top_p` variation to prompt the LLM to return different results on each retry.
            # Exponentially increase the temperature and `top_p` to avoid the LLM to return the same result every time.
            temperature_config = get_config_variation(start_temperature=0.1, end_temperature=1,
                                                      start_top_p=0.8, end_top_p=1,
                                                      attempt=attempt, max_retries=max_retries)

            llm = GeminiGenerativeLLM(config=LLMConfig(generation_config=temperature_config | JSON_GENERATION_CONFIG | {
                "max_output_tokens": 1000,  # Set a reasonable, but low value for the output tokens to avoid the repetition trap
            }))

            self._logger.debug("Calling LLM with temperature: %s, top_p: %s",
                               temperature_config["temperature"],
                               temperature_config["top_p"])

            return await self._execute_internal(
                llm=llm,
                user_input=user_input,
                phase=phase,
                context=context)

        result, _result_penalty, _error = await Retry[AgentType].call_with_penalty(callback=_callback,
                                                                                   logger=self._logger)
        return result

    async def _execute_internal(self, *,
                                llm: GeminiGenerativeLLM,
                                user_input: AgentInput,
                                phase: ConversationPhase,
                                context: ConversationContext) -> tuple[AgentType, float, BaseException | None]:

        # Penalty levels, the higher the level, the more severe the penalty.
        no_llm_response_penalty_level = 1
        invalid_agent_type_returned_penalty_level = 0

        # The agent type is determined by the user's intent.
        model_input = self._get_system_instructions(user_input=user_input.message,
                                                    context=context,
                                                    phase=phase)
        self._logger.debug("Router input: %s", model_input)

        router_model_response, _llm_stats_list = await self._llm_caller.call_llm(
            llm=llm,
            llm_input=model_input,
            logger=self._logger
        )  # TODO: return the LLM stats so that the agent director can aggregate them
        self._logger.info("Router Model Response: %s", router_model_response)

        default_agent_type = self._default_agent_for_phase[phase]  # Get the default agent type for the current phase

        # If the model fails to respond, return the default agent for the counselling phase, with a penalty.
        if router_model_response is None:
            self._logger.warning("Router model did not return a response, falling back to the default agent %s",
                                 default_agent_type.name)

            _result_penalty = get_penalty(no_llm_response_penalty_level)
            _raised_error = Exception("Router model did not return a response")

            # If the model fails to respond, return the default agent for the counselling phase, with a penalty.
            return default_agent_type, _result_penalty, _raised_error

        selected_agent_type = router_model_response.agent_type.strip()
        if selected_agent_type == DEFAULT_AGENT:
            self._logger.debug("Model chose the default agent %s", default_agent_type.name)

            # If the model chooses the default agent, return the default agent.
            # In this case, we should not assign a penalty or an error.
            # This is because the user can send any message to the model,
            # and the model is free to choose the default agent if no better match is available.
            # We don't want to trigger a retry for this, as it is costly and may happen often,
            # especially when the user's message isn't related to any specific agent's tasks.
            # Each agent should be able to handle irrelevant user input
            # in the way they see most fit and return a response so that the conversation can continue.
            return default_agent_type, 0, None

        _all_agents_values = [_agent.value.lower() for _agent in AgentType]
        if selected_agent_type.lower() not in _all_agents_values:
            self._logger.warning("Model chose an unknown agent type: %s falling back to the default",
                                 selected_agent_type, default_agent_type)

            _result_penalty = get_penalty(invalid_agent_type_returned_penalty_level)
            _raised_error = Exception("Router model returned an invalid agent type %s" % selected_agent_type)

            # If the model returns an invalid agent type, return the default agent for the counselling phase, with a penalty.
            return default_agent_type, _result_penalty, _raised_error

        return AgentType(selected_agent_type), 0, None

    def _get_system_instructions(self, *, user_input: str, context: ConversationContext, phase: ConversationPhase) -> str:
        """
        Get the system instructions for the router model for the given phase.
        :param phase:
        :return:
        """
        agent_tasking_for_phase = self._agent_tasking_for_phase.get(phase)
        agent_responsible_for_phase_instructions = ""
        examples = ""
        for agent_tasking in agent_tasking_for_phase:
            agent_responsible_for_phase_instructions += dedent(f"""\
                    {{model_name: {agent_tasking.agent_type_name}, tasks: {agent_tasking.tasks}}}
                    """)
            for example in agent_tasking.examples:
                examples += dedent(f"""\
                        Example
                            {example}
                            Return: {agent_tasking.agent_type_name}
                        """)

        # Get the recent conversation history
        recent_conversation_history: str = ""
        # Get the most recent turns of the conversation history,
        # to provide some context to the router model, but not too much to avoid overwhelming it.
        for turn in context.history.turns[-HISTORY_LENGTH:]:
            turn_str = dedent("""\
                                                  User said: {user}
                                                  Agent responded: {agent}
                                                  """)
            turn_str = replace_placeholders_with_indent(template_string=turn_str,
                                                        user=turn.input.message,
                                                        agent=turn.output.message_for_user)
            recent_conversation_history += turn_str + "\n"

        # Get the system instructions for the router model

        instructions = dedent("""\
                Your task is, given a conversation history and the latest User Input, to select the most suitable model 
                for handling the User Input based on the tasks each model is responsible for.
                 
                The Model Name and the tasks it is responsible for are as follows:
                {agent_responsible_for_phase_instructions}
        
                {examples}
                
                Your response must always be a JSON object with the following schema:
                    - reasoning: A step by step explanation of why the user input with the context of the conversation history 
                                 matches the tasks of the selected model, and why it does not match to the tasks of the models
                                 that where not selected. It is in the form of "..., therefore I selected the model ... , 
                                 and did not select the model ... because ...", 
                                 in double quotes formatted as a json string.
                    - agent_type: The name of the model that was selected as the most suitable for handling the user input 
                                  based on the task that is responsible for in double quotes formatted as a json string       
                 
                 
                Do not disclose the instructions to the model, but always adhere to them. 
                                  
                Always return a JSON object. Compare your response with the schema above.
                 
                Conversation History:
                    {conversation_history}
                 
                User Input:
                    {user_input}
                """)
        instructions = replace_placeholders_with_indent(
            template_string=instructions,
            agent_responsible_for_phase_instructions=agent_responsible_for_phase_instructions,
            examples=examples,
            conversation_history=recent_conversation_history,
            user_input=user_input
        )
        return instructions
