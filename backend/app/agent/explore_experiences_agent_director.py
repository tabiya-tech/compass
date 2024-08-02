import logging
import time
from enum import Enum
from typing import Optional

from pydantic import BaseModel

from app.agent.skill_explorer_agent import SkillsExplorerAgent
from app.agent.skill_linking_ranking import SkillsLinkingTool
from app.countries import Country
from app.agent.collect_experiences_agent import CollectExperiencesAgent
from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.infer_occupation_tool.infer_occupation_tool import InferOccupationTool
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
    EXPLORING_SKILLS = 1
    LINKING_RANKING = 2
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
                                     state: ExploreExperiencesAgentDirectorState) -> AgentOutput:

        current_experience: ExperienceState
        if state.current_experience_uuid is None:
            # Pick the next experience to process
            current_experience = _pick_next_experience_to_process(state.experiences_state)
        else:
            # Get the current experience from the state
            current_experience = state.experiences_state.get(state.current_experience_uuid, None)

        if not current_experience:
            message = AgentOutput(
                message_for_user="It looks like, there are no experiences to discuss further.",
                finished=True,
                agent_type=self._agent_type,
                agent_response_time_in_sec=0,
                llm_stats=[]
            )
            await self._conversation_manager.update_history(user_input, message)
            return message

        # ensure that the current experience is set in the state
        state.current_experience_uuid = current_experience.experience.uuid
        picked_new_experience = False

        if current_experience.dive_in_phase == DiveInPhase.NOT_STARTED:
            # Start the first sub-phase
            current_experience.dive_in_phase = DiveInPhase.EXPLORING_SKILLS
            picked_new_experience = True

        # Sub-phase 2
        if current_experience.dive_in_phase == DiveInPhase.EXPLORING_SKILLS:

            if picked_new_experience:
                # TODO: when transitioning between states set this message to ""
                # and handle it in the execute method of the agent
                # alternatively, set the message in the execute method

                user_input = AgentInput(message="Hi, I am ready to explore my skills", is_artificial=True)
            # The agent will explore the skills for the experience and update the experience entity
            self._exploring_skills_agent.set_experience(current_experience.experience)
            agent_output: AgentOutput = await self._exploring_skills_agent.execute(user_input, context)
            # Update the conversation history
            await self._conversation_manager.update_history(user_input, agent_output)
            if not agent_output.finished:
                return agent_output

            # advance to the next sub-phase
            current_experience.dive_in_phase = DiveInPhase.LINKING_RANKING

        if current_experience.dive_in_phase == DiveInPhase.LINKING_RANKING:
            # Infer the occupations for the experience and update the experience entity
            # , then link the skills and rank them
            agent_output = await self._link_and_rank(current_experience.experience)
            await self._conversation_manager.update_history(AgentInput(
                message="(silence)",
                is_artificial=True
            ), agent_output)
            # completed processing this experience
            current_experience.dive_in_phase = DiveInPhase.PROCESSED
            state.current_experience_uuid = None

            # If the agent has finished exploring the skills, then if there are no more experiences to process,
            # then we are done
            _next_experience = _pick_next_experience_to_process(state.experiences_state)
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
            return await self._dive_into_experiences(user_input, context, state)

    async def execute(self, user_input: AgentInput, context: ConversationContext) -> AgentOutput:
        if self._state is None:
            raise ValueError("ExperiencesExplorerAgentDirector: execute() called before state was initialized")

        state = self._state

        # Flag to indicate if we transitioned between conversation phases
        transitioned_between_states = False

        # First collect all the experiences from the user
        if state.conversation_phase == ConversationPhase.COLLECT_EXPERIENCES:
            agent_output = await self._collect_experiences_agent.execute(user_input, context)
            await self._conversation_manager.update_history(user_input, agent_output)

            # The experiences are still being collected, but we can already store them so that we can
            # present them to the user even if data collection has not finished.
            # The experiences will be overwritten every time
            experiences = self._collect_experiences_agent.get_experiences()
            state.experiences_state.clear()
            for exp in experiences:
                state.experiences_state[exp.uuid] = ExperienceState(experience=exp)

            # If collecting is not finished then return the output to the user to continue collecting
            if not agent_output.finished:
                return agent_output

            # and transition to the next phase
            state.conversation_phase = ConversationPhase.DIVE_IN
            transitioned_between_states = True

        # Then dive into each of the experiences collected
        if state.conversation_phase == ConversationPhase.DIVE_IN:

            if transitioned_between_states:
                user_input = AgentInput(
                    message="I am ready to dive into my experiences, don't greet me, let's get into it immediately",
                    is_artificial=True)

            # The conversation history is handled in dive_into_experiences method,
            # as there is another transition between sub-phases happening there
            agent_output = await self._dive_into_experiences(user_input, context, state)
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
        self._exploring_skills_agent = SkillsExplorerAgent()
        self._skills_linking_tool = SkillsLinkingTool(search_services.skill_search_service)

    def get_collect_experiences_agent(self) -> CollectExperiencesAgent:
        return self._collect_experiences_agent

    async def _link_and_rank(self, current_experience: ExperienceEntity) -> AgentOutput:
        start = time.time()
        inferred_occupations = await self._infer_occupations_tool.execute(
            country_of_interest=Country.SOUTH_AFRICA,
            experience=current_experience
        )
        current_experience.contextual_title = inferred_occupations.contextualized_title
        current_experience.esco_occupations = inferred_occupations.esco_occupations
        # Link the skills and rank them
        top_skills = await self._skills_linking_tool.link_and_rank_skills(
            esco_occupations=inferred_occupations.esco_occupations,
            responsibilities_data=current_experience.responsibilities)
        current_experience.top_skills = top_skills
        # construct a summary of the skills
        skills_summary = "\n"
        for skill in top_skills:
            skills_summary += f"• {skill.preferredLabel}\n"

        end = time.time()
        agent_output: AgentOutput = AgentOutput(
            message_for_user=f"After examining the information you provided, "
                             f"I identified the following skills:"
                             f"{skills_summary}",
            finished=False,
            agent_type=self._agent_type,
            agent_response_time_in_sec=round(end - start, 2),
            llm_stats=[inferred_occupations.stats]
        )
        return agent_output
