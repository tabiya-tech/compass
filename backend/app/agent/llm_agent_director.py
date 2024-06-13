from textwrap import dedent

from pydantic import BaseModel

from app.agent.agent import Agent
from app.agent.agent_director import AbstractAgentDirector, ConversationPhase
from app.agent.agent_types import AgentInput, AgentOutput, AgentType
from app.agent.farewell_agent import FarewellAgent
from app.agent.skill_explore_agent import SkillExplorerAgent
from app.agent.experiences_explorer_agent import ExperiencesExplorerAgent
from app.agent.welcome_agent import WelcomeAgent
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.vector_search.similarity_search_service import SimilaritySearchService
from common_libs.llm.models_utils import LLMConfig
from common_libs.llm.generative_models import GeminiGenerativeLLM

DEFAULT_AGENT = "DefaultAgent"


# TODO should return json with CoT reasoning to improve performance
#  additionally it should include the LLM stats for the router model
#  and should be persisted in the agent director state
class RouterModelResponse(BaseModel):
    """
    The response from the router model
    """
    agent_type: AgentType


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


class LLMAgentDirector(AbstractAgentDirector):
    """
    Receives user input, understands the conversation context and the user intent and routes
    the user input to the appropriate agent.
    """

    def __init__(self, conversation_manager: ConversationMemoryManager, skill_search_service: SimilaritySearchService):
        super().__init__(conversation_manager)
        # initialize the agents
        self._agents: dict[AgentType, Agent] = {
            AgentType.WELCOME_AGENT: WelcomeAgent(),
            AgentType.SKILL_EXPLORER_AGENT: SkillExplorerAgent(),
            AgentType.EXPERIENCES_EXPLORER_AGENT: ExperiencesExplorerAgent(skill_search_service),
            AgentType.FAREWELL_AGENT: FarewellAgent()
        }
        # define the tasks that each agent is responsible for
        welcome_agent_tasks = AgentTasking(agent_type_name=AgentType.WELCOME_AGENT.value,
                                           tasks="Welcomes the user and answers any questions "
                                                 "regarding the process and the tool.",
                                           examples=["How does the counseling process work?"])
        skill_explorer_agent_tasks = AgentTasking(agent_type_name=AgentType.SKILL_EXPLORER_AGENT.value,
                                                  tasks="Explore and verify the users skill.",
                                                  examples=["I worked as a software developer for 5 years.",
                                                            "I am ready to explore my skills."])
        farewell_agent_tasks = AgentTasking(agent_type_name=AgentType.FAREWELL_AGENT.value,
                                            tasks="Ends the conversation with the user.",
                                            examples=["I want to finish the conversation."])
        default_agent_tasks = AgentTasking(agent_type_name=DEFAULT_AGENT,
                                           tasks="Handles all other queries that do not fall under the purview "
                                                 "of the other agents, or when it is not clear "
                                                 "which agent is most suitable.",
                                           examples=[])
        # define the tasks for each phase
        self._agent_tasking_for_phase: dict[ConversationPhase, list[AgentTasking]] = {
            ConversationPhase.INTRO: [welcome_agent_tasks, default_agent_tasks],
            ConversationPhase.CONSULTING: [welcome_agent_tasks, skill_explorer_agent_tasks, default_agent_tasks],
            ConversationPhase.CHECKOUT: [farewell_agent_tasks, default_agent_tasks]
        }
        # initialize the router model
        self._model = GeminiGenerativeLLM(config=LLMConfig())

    def get_experiences_explorer_agent(self):
        return self._agents[AgentType.EXPERIENCES_EXPLORER_AGENT]

    def _get_system_instructions(self, phase: ConversationPhase) -> str:
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

        instructions = dedent(f"""\
        Process the user input and return the name of the most suitable model for handling the user input, 
        based on the tasks each model is responsible for. 
        The Model Name and the tasks it is responsible for are as follows:
        {agent_responsible_for_phase_instructions}

        {examples}
        Return only the model name as a string, do not format it.
        """)
        return instructions

    async def _get_suitable_agent_type(self, user_input: AgentInput, phase: ConversationPhase) -> AgentType:
        """
        Get the agent type most suitable to handle the user input
        based on the user input and the current conversation phase.
        :param user_input: The user input
        :return: The agent type that is most suitable for handling the user input
        :raises ValueError: If the conversation has ended
        """

        if phase == ConversationPhase.ENDED:
            raise ValueError("Conversation has ended, no more agents to run")

        # Currently, in the intro phase, only the welcome agent is active
        if phase == ConversationPhase.INTRO:
            return AgentType.WELCOME_AGENT

        # In the consulting phase, the agent type is determined by the user's intent
        if phase == ConversationPhase.CONSULTING:
            model_input = f"{self._get_system_instructions(phase)}\nUser Input: {user_input.message}\n"
            try:
                router_model_response = (await self._model.generate_content(model_input)).text.strip()
                self._logger.debug("Router Model Response: %s", router_model_response)
                if router_model_response == DEFAULT_AGENT:
                    return AgentType.SKILL_EXPLORER_AGENT
                return AgentType(router_model_response)
            except Exception as e:  # pylint: disable=broad-except
                self._logger.error("Error while getting the suitable agent: %s", e)
                # If the model fails to respond, return the default agent for the consulting phase
                return AgentType.SKILL_EXPLORER_AGENT

        # In the checkout phase, only the farewell agent is active
        if phase == ConversationPhase.CHECKOUT:
            return AgentType.FAREWELL_AGENT

    def _get_new_phase(self, agent_output: AgentOutput) -> ConversationPhase:
        """
        Get the new conversation phase based on the agent output and the current phase.
        """
        current_phase = self._state.current_phase

        # ConversationPhase.ENDED is the final phase
        if current_phase == ConversationPhase.ENDED:
            return ConversationPhase.ENDED

            # In the intro phase, only the welcome agent can end the phase
        if (current_phase == ConversationPhase.INTRO
                and agent_output.agent_type == AgentType.WELCOME_AGENT
                and agent_output.finished):
            return ConversationPhase.CONSULTING

        # In the consulting phase, only the skill explorer agent can end the phase
        if (current_phase == ConversationPhase.CONSULTING
                and agent_output.agent_type == AgentType.SKILL_EXPLORER_AGENT
                and agent_output.finished):
            return ConversationPhase.CHECKOUT

        # In the checkout phase, only the farewell agent can end the phase
        if (current_phase == ConversationPhase.CHECKOUT
                and agent_output.agent_type == AgentType.FAREWELL_AGENT
                and agent_output.finished):
            return ConversationPhase.ENDED

        return current_phase

    async def execute(self, user_input: AgentInput) -> AgentOutput:
        """
        Run the conversation task for the current user input.
        Progress the conversation phase based on the agent output and the current phase.
        When all agents are done, return a message to the user that the conversation is finished.
        :param user_input: The user input
        :return: The output from the agent
        """
        try:
            current_phase = self._state.current_phase
            if current_phase == ConversationPhase.ENDED:
                return AgentOutput(
                    message_for_user="Conversation finished, nothing to do!",
                    finished=True,
                    agent_type=None,
                    reasoning="Conversation has ended",
                    agent_response_time_in_sec=0,  # artificial value as there is no LLM call
                    llm_stats=[]  # artificial value as there is no LLM call
                )

            # Get the context
            context = await self._conversation_manager.get_conversation_context()
            clean_input: AgentInput = user_input.copy()  # make a copy of the user input to avoid modifying the original
            clean_input.message = clean_input.message.strip()  # Remove leading and trailing whitespaces

            # Get the agent to run
            suitable_agent_type = await self._get_suitable_agent_type(clean_input, current_phase)
            self._logger.debug("Running agent: %s", {suitable_agent_type})
            agent_for_task = self._agents.get(suitable_agent_type)

            # Perform the task
            agent_output = await agent_for_task.execute(clean_input, context)
            await self._conversation_manager.update_history(clean_input, agent_output)

            # Update the conversation phase
            new_phase = self._get_new_phase(agent_output)
            self._logger.debug("Transitioned phase from %s --to-> %s", current_phase, new_phase)
            if current_phase != new_phase:
                self._state.current_phase = new_phase
                # When transitioning to a new phase do not return the control back to the user,
                # instead, run the next agent in the sequence
                next_agent_output = await self.execute(user_input=AgentInput(message="(silence)"))
                return AgentOutput(
                    #  Combine the messages from the current and the next agent,
                    #  so that the user can see the two responses in last message of the conversation.
                    #  Returning a list of messages is also an option, but it requires more complex handling
                    #  in the frontend, as the (silence) message should not be displayed to the user.
                    message_for_user=agent_output.message_for_user + "\n\n" + next_agent_output.message_for_user,
                    finished=next_agent_output.finished,
                    agent_type=next_agent_output.agent_type,
                    reasoning=next_agent_output.reasoning,
                    agent_response_time_in_sec=next_agent_output.agent_response_time_in_sec,
                    llm_stats=next_agent_output.llm_stats
                )

            # return the agent output
            return agent_output
        # executing an agent can raise any number of unknown exceptions
        except Exception as e:  # pylint: disable=broad-except
            self._logger.error("Error while executing the agent director: %s", e, exc_info=True)
            return AgentOutput(
                message_for_user="Conversation forcefully ended",
                finished=True,
                agent_type=None,
                reasoning="Error while executing the agent director",
                agent_response_time_in_sec=0,  # TODO(Apostolos): for now an artificial value. TBC if it should be 0
                llm_stats=[]  # TODO (Apostolos): for now an artificial value. TBC if it should be an empty list
            )
