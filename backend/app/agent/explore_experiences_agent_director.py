import logging
from enum import Enum
from typing import Optional

from pydantic import BaseModel

from app.countries import Country
from app.agent.collect_experiences_agent import CollectExperiencesAgent
from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.infer_occupation_tool.infer_occupation_tool import InferOccupationTool
from app.agent.skill_explorer_agent import SkillExplorerAgent
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager

from app.agent.agent import Agent
from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.agent_types import AgentType
from app.conversation_memory.conversation_memory_types import \
    ConversationContext
from app.vector_search.vector_search_dependencies import SearchServices

logger = logging.getLogger(__name__)


class ConversationPhase(Enum):
    """
    The Explore Experience Agent Director drives the conversation for exploring previous experiences.
    It has sub-agents, and its main role is to route between these sub agents to keep the conversation flowing.
    It does not do conversation turns by itself, the conversation turns are delegated to the sub-agents.
    """
    COLLECT_EXPERIENCES = 0
    DIVE_IN = 1


class DiveInPhase(Enum):
    """
    The DIVE_IN sub-phases
    """
    NOT_STARTED = 0
    INFERRING_OCCUPATIONS = 1
    EXPLORING_SKILLS = 2
    PROCESSED = 3


class ExperienceState(BaseModel):
    """
    State Metadata for an experience that is being explored with the user.
    """
    dive_in_phase: DiveInPhase = DiveInPhase.NOT_STARTED
    """
    The current sub-phase of the experience exploration
    """

    experience: ExperienceEntity
    """
    The experience entity that is being explored.
    """


class ExploreExperiencesAgentDirectorState(BaseModel):
    """
    Stores the user-specific state for this agent. Managed centrally.
    """
    session_id: int

    experiences_state: dict[str, ExperienceState] = {}
    """
    The state of the experiences of the user that are being explored, keyed by experience.uuid
    """

    current_experience_uuid: Optional[str] = None
    """
    The key in the experiences dict of the current experience under discussion
    If None, then no experience is currently being processed
    """

    conversation_phase: ConversationPhase = ConversationPhase.COLLECT_EXPERIENCES
    """
    The current conversation phase   
    """

    def __init__(self, session_id):
        super().__init__(session_id=session_id)


def _pick_next_experience_to_process(experiences: dict[str, ExperienceState]) -> ExperienceState | None:
    # Pick the first experience to process from the ones that have not been processed yet,
    # or None if all experiences have been processed
    for exp in experiences.values():
        # Comparing with DiveInPhase.PROCESSED as this
        if exp.dive_in_phase != DiveInPhase.PROCESSED:
            return exp

    return None


class ExploreExperiencesAgentDirector(Agent):
    """
    Agent that explores the skills of the user and provides a response based on the task.

    This is a stateful agent.
    """

    async def _dive_into_experiences(self, user_input: AgentInput, context: ConversationContext,
                                     s: ExploreExperiencesAgentDirectorState) -> AgentOutput:

        current_experience: ExperienceState
        if s.current_experience_uuid is None:
            # Pick the next experience to process
            current_experience = _pick_next_experience_to_process(s.experiences_state)
        else:
            current_experience = s.experiences_state.get(s.current_experience_uuid, None)

        if not current_experience:
            return AgentOutput(
                message_for_user="I am a bit confused, it seems that there no experiences to process.",
                finished=False,
                agent_type=self._agent_type,
                agent_response_time_in_sec=0,
                llm_stats=[]
            )
        # ensure that the current experience is set in the state
        s.current_experience_uuid = current_experience.experience.uuid

        if current_experience.dive_in_phase == DiveInPhase.NOT_STARTED:
            # Start the first sub-phase
            current_experience.dive_in_phase = DiveInPhase.INFERRING_OCCUPATIONS

        transitioned_between_states = False
        if current_experience.dive_in_phase == DiveInPhase.INFERRING_OCCUPATIONS:
            # The agent will infer the occupations for the experience and update the experience entity

            inferred_occupations = await self._infer_occupations_tool.execute(
                country_of_interest=Country.SOUTH_AFRICA,
                experience=current_experience.experience
            )
            current_experience.experience.contextual_title = inferred_occupations.contextualized_title
            current_experience.experience.esco_occupations = inferred_occupations.esco_occupations
            agent_output: AgentOutput = AgentOutput(
                message_for_user=f"I have inferred the occupations for the experience: "
                                 f"{current_experience.experience.contextual_title}",
                finished=True,
                agent_type=self._agent_type,
                agent_response_time_in_sec=inferred_occupations.stats.response_time_in_sec,
                llm_stats=[inferred_occupations.stats]
            )
            await self._conversation_manager.update_history(user_input, agent_output)

            if not agent_output.finished:
                return agent_output

            # advance to the next sub-phase
            current_experience.dive_in_phase = DiveInPhase.EXPLORING_SKILLS
            transitioned_between_states = True

        # Sub-phase 2
        if current_experience.dive_in_phase == DiveInPhase.EXPLORING_SKILLS:

            if transitioned_between_states:
                user_input = AgentInput(message="Hi, I am ready to explore my skills", is_artificial=True)
            # The agent will explore the skills for the experience and update the experience entity
            self._exploring_skills_agent.set_experience(current_experience.experience)
            agent_output: AgentOutput = await self._exploring_skills_agent.execute(user_input, context)
            # Update the conversation history
            await self._conversation_manager.update_history(user_input, agent_output)
            if not agent_output.finished:
                return agent_output

            current_experience.dive_in_phase = DiveInPhase.PROCESSED
            s.current_experience_uuid = None

            # If the agent has finished exploring the skills, then if there are no more experiences to process,
            # then we are done
            _next_experience = _pick_next_experience_to_process(s.experiences_state)
            if not _next_experience:
                # No more experiences to process, we are done
                return AgentOutput(
                    message_for_user="I have finished exploring all your experiences.",
                    finished=True,
                    agent_type=self._agent_type,
                    agent_response_time_in_sec=0,
                    llm_stats=[]
                )

            # Otherwise, we have more experiences to process
            return await self._dive_into_experiences(user_input, context, s)

    async def execute(self, user_input: AgentInput, context: ConversationContext) -> AgentOutput:
        if self._state is None:
            raise ValueError("ExperiencesExplorerAgentDirector: execute() called before state was initialized")

        s = self._state

        # Flag to indicate if we transitioned between conversation phases
        transitioned_between_states = False

        # First collect all the experiences from the user
        if s.conversation_phase == ConversationPhase.COLLECT_EXPERIENCES:
            agent_output = await self._collect_experiences_agent.execute(user_input, context)
            await self._conversation_manager.update_history(user_input, agent_output)

            # If collecting is not finished then return the output to the user to continue collecting
            if not agent_output.finished:
                return agent_output

            # Collecting has finished, update the state with the experiences
            experiences = self._collect_experiences_agent.get_experiences()
            for exp in experiences:
                s.experiences_state[exp.uuid] = ExperienceState(experience=exp)

            # and transition to the next phase
            s.conversation_phase = ConversationPhase.DIVE_IN
            transitioned_between_states = True

        # Then dive into each of the experiences collected
        if s.conversation_phase == ConversationPhase.DIVE_IN:

            if transitioned_between_states:
                user_input = AgentInput(
                    message="I am ready to dive into my experiences, don't greet me, let's get into it immediately",
                    is_artificial=True)

            # The conversation history is handled in dive_into_experiences method,
            # as there is another transition between sub-phases happening there
            agent_output = await self._dive_into_experiences(user_input, context, s)
            return agent_output

        # Should never happen
        raise ValueError("ExperiencesExplorerAgentDirector: Unknown conversation phase")

    def set_state(self, state: ExploreExperiencesAgentDirectorState):
        """
        Set the state for this stateful agent. The state is owed centrally by the application state manager
        """

        self._state = state

    def __init__(self, *,
                 conversation_manager: ConversationMemoryManager,
                 search_services: SearchServices,
                 ):
        super().__init__(agent_type=AgentType.EXPLORE_EXPERIENCES_AGENT,
                         is_responsible_for_conversation_history=True)
        self._search_services = search_services
        self._conversation_manager = conversation_manager
        self._state: ExploreExperiencesAgentDirectorState | None = None
        self._collect_experiences_agent = CollectExperiencesAgent()
        self._infer_occupations_tool = InferOccupationTool(search_services.occupation_skill_search_service)
        self._exploring_skills_agent = SkillExplorerAgent()

    def get_collect_experiences_agent(self) -> CollectExperiencesAgent:
        return self._collect_experiences_agent
