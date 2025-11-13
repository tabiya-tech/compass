from enum import Enum
from typing import Optional, Mapping, Any

import time
from pydantic import BaseModel, field_serializer, field_validator, Field

from app.agent.agent import Agent
from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.agent_types import AgentType, LLMStats
from app.agent.collect_experiences_agent import CollectExperiencesAgent
from app.agent.experience._experience_summarizer import ExperienceSummarizer
from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.experience.upgrade_experience import get_editable_experience
from app.agent._readiness_assessment_llm import _ReadinessAssessmentLLM, MIN_RESPONSIBILITIES_FOR_AUTO_LINKING
from app.agent.linking_and_ranking_pipeline import ExperiencePipeline, ExperiencePipelineConfig
from app.agent.skill_explorer_agent import SkillsExplorerAgent
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.conversation_memory.conversation_memory_types import \
    ConversationContext
from app.countries import Country
from app.vector_search.esco_entities import SkillEntity
from app.vector_search.vector_search_dependencies import SearchServices

def _format_responsibilities_for_display(responsibilities: list[str], experience_title: str = None) -> str:
    """
    Format responsibilities list for display to the user.
    
    Args:
        responsibilities: List of responsibility strings
        experience_title: Title of the experience to include in the message
        
    Returns:
        Formatted string showing the responsibilities
    """
    if not responsibilities:
        return "No responsibilities have been collected yet."

    formatted = f"Great, here's what we have for your experience as '{experience_title}':\n\n"
    
    for resp in responsibilities:
        formatted += f"- {resp}\n"

    return formatted


async def _check_and_prompt_for_linking(*,
                                        logger,
                                        current_experience: "ExperienceState",
                                        user_input: AgentInput,
                                        context: ConversationContext,
                                        conversation_manager: ConversationMemoryManager) -> tuple[
    AgentOutput | None, bool, list[LLMStats]]:
    """
    Check if we should prompt the user to continue to linking/ranking phase.
    
    Returns:
        A tuple of (AgentOutput | None, should_continue_to_linking, llm_stats)
    """
    # Check if we're in EXPLORING_SKILLS phase
    if current_experience.dive_in_phase != DiveInPhase.EXPLORING_SKILLS:
        return None, False, []

    # Check if we have enough responsibilities using the LLM's heuristic check
    responsibilities_count = len(current_experience.experience.responsibilities.responsibilities)
    if not _ReadinessAssessmentLLM.has_enough_responsibilities(responsibilities_count):
        logger.info(
            "Responsibilities Check: Not enough responsibilities (%d) to prompt for linking, need at least %d",
            responsibilities_count,
            MIN_RESPONSIBILITIES_FOR_AUTO_LINKING
        )
        return None, False, []

    # Create the prompt message (we'll use this for both initial prompt and LLM parsing)
    responsibilities_text = _format_responsibilities_for_display(
        current_experience.experience.responsibilities.responsibilities,
        experience_title=current_experience.experience.experience_title
    )
    prompt_message = (
        f"{responsibilities_text}\n\n"
        f"Are you sure this is all you did, or is there more you would like to add? "
    )

    # Check if we've already asked
    if current_experience.asked_to_continue_to_linking:
        # We've already asked, so parse the user's response using LLM
        if user_input.is_artificial:
            # This is an artificial input (like when transitioning), don't process it
            logger.info("Responsibilities Check: Artificial input, not processing")
            return None, False, []

        # Use LLM to parse the user's response
        llm_parser = _ReadinessAssessmentLLM(logger)
        user_wants_to_continue, clarification_message, llm_stats = await llm_parser.execute(
            responsibilities=current_experience.experience.responsibilities.responsibilities,
            responsibilities_count=responsibilities_count,
            user_input=user_input.message,
            context=context
        )

        if user_wants_to_continue:
            # User wants to continue to linking
            logger.info("Responsibilities Check: User wants to continue to linking (LLM parsed)")
            return None, True, llm_stats
        else:
            # User wants to add more responsibilities
            current_experience.asked_to_continue_to_linking = False  # Reset so we can ask again later
            logger.info("Responsibilities Check: User wants to add more responsibilities (LLM parsed)")

            # If there's a clarification message, return it
            if clarification_message:
                clarification_output = AgentOutput(
                    message_for_user=clarification_message,
                    finished=False,
                    agent_type=AgentType.EXPLORE_EXPERIENCES_AGENT,
                    agent_response_time_in_sec=0,
                    llm_stats=llm_stats
                )
                # Record the user's input and clarification in conversation history
                await conversation_manager.update_history(user_input, clarification_output)
                return clarification_output, False, llm_stats

            return None, False, llm_stats

    # We haven't asked yet, so show responsibilities and ask
    # Mark that we've asked
    current_experience.asked_to_continue_to_linking = True

    # Create and return the prompt
    agent_output = AgentOutput(
        message_for_user=prompt_message,
        finished=False,
        agent_type=AgentType.EXPLORE_EXPERIENCES_AGENT,
        agent_response_time_in_sec=0,
        llm_stats=[]
    )

    # Update conversation history
    await conversation_manager.update_history(user_input, agent_output)

    return agent_output, False, []


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

    asked_to_continue_to_linking: bool = False
    """
    Flag to track if we've already asked the user if they want to continue to linking/ranking.
    This prevents asking multiple times.
    """

    class Config:
        extra = "forbid"

    # use a field serializer to serialize the dive_in_phase
    # we use the name of the Enum instead of the value because that makes the code less brittle
    @field_serializer("dive_in_phase")
    def serialize_dive_in_phase(self, dive_in_phase: DiveInPhase, _info):
        return dive_in_phase.name

    # Deserialize the dive_in_phase from the enum name
    @field_validator("dive_in_phase", mode='before')
    def deserialize_dive_in_phase(cls, value: DiveInPhase | str) -> DiveInPhase:
        if isinstance(value, str):
            return DiveInPhase[value]
        return value


class ExploreExperiencesAgentDirectorState(BaseModel):
    """
    Stores the user-specific state for this agent. Managed centrally.
    """

    session_id: int
    """
    The session ID of the user.
    """

    country_of_user: Country = Field(default=Country.UNSPECIFIED)
    """
    The country of the user.
    """

    experiences_state: dict[str, ExperienceState] = Field(default_factory=dict)
    """
    The state of the experiences of the user that are being explored, keyed by experience.uuid
    """

    explored_experiences: list[ExperienceEntity[tuple[int, SkillEntity]]] | None = Field(default_factory=list)
    """
    Experiences that have been explored so far.
    This is also used as a copy of what users are able to see and edit in the UI.
    """

    deleted_experiences: list[ExperienceEntity[tuple[int, SkillEntity]]] = Field(default_factory=list)
    """
    Experiences that have been deleted by the user. The ones that should be hidden by the user.
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

    class Config:
        extra = "forbid"

    @field_serializer("country_of_user")
    def serialize_country_of_user(self, country_of_user: Country, _info):
        return country_of_user.name

    @field_validator("country_of_user", mode='before')
    def deserialize_country_of_user(cls, value: str | Country) -> Country:
        if isinstance(value, str):
            return Country[value]
        return value

    # use a field serializer to serialize the conversation_phase
    # we use the name of the Enum instead of the value because that makes the code less brittle
    @field_serializer("conversation_phase")
    def serialize_conversation_phase(self, conversation_phase: ConversationPhase, _info):
        return conversation_phase.name

    # Deserialize the conversation_phase from the enum name
    @field_validator("conversation_phase", mode='before')
    def deserialize_conversation_phase(cls, value: ConversationPhase | str) -> ConversationPhase:
        if isinstance(value, str):
            return ConversationPhase[value]
        return value

    @staticmethod
    def from_document(_doc: Mapping[str, Any]) -> "ExploreExperiencesAgentDirectorState":
        return ExploreExperiencesAgentDirectorState(
            session_id=_doc["session_id"],
            # For backward compatibility with old documents that don't have the country_of_user field, set it to UNSPECIFIED
            country_of_user=_doc.get("country_of_user", Country.UNSPECIFIED),
            experiences_state=_doc["experiences_state"],
            current_experience_uuid=_doc["current_experience_uuid"],

            # For backward compatibility with old documents that don't have the explored_experiences field,
            # The default value is None, which means that the state is legacy and should be upgraded
            explored_experiences=_doc.get("explored_experiences", None),
            deleted_experiences=_doc.get("deleted_experiences", []),
            conversation_phase=_doc["conversation_phase"])


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

    async def _dive_into_experiences(self, *,
                                     user_input: AgentInput,
                                     context: ConversationContext,
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
                # When transitioning between states set this message to "" and handle it in the execute method of the agent
                user_input = AgentInput(message="", is_artificial=True)

            # Check if we should prompt the user to continue to linking/ranking
            prompt_output, should_continue_to_linking, llm_stats = await _check_and_prompt_for_linking(
                logger=self.logger,
                current_experience=current_experience,
                user_input=user_input,
                context=context,
                conversation_manager=self._conversation_manager
            )

            # If we need to show a prompt, return it
            # Note: If prompt_output is a clarification message (user gave unclear response),
            # the user's input has already been recorded in _check_and_prompt_for_linking
            # If prompt_output is the initial prompt, it was also recorded there
            if prompt_output is not None:
                return prompt_output

            # If user said yes, advance to linking/ranking phase
            if should_continue_to_linking:
                # Record the user's response in conversation history
                confirmation_output = AgentOutput(
                    message_for_user="Great! Let's continue to the next step.",
                    finished=False,
                    agent_type=self._agent_type,
                    agent_response_time_in_sec=0,
                    llm_stats=llm_stats
                )
                await self._conversation_manager.update_history(user_input, confirmation_output)
                # get the context again after updating the history
                await self._conversation_manager.get_conversation_context()

                current_experience.dive_in_phase = DiveInPhase.LINKING_RANKING
                # Reset the flag for future use
                current_experience.asked_to_continue_to_linking = False
            else:
                # Continue with the skills explorer agent
                # The agent will explore the skills for the experience and update the experience entity
                self._exploring_skills_agent.set_experience(current_experience.experience)
                agent_output: AgentOutput = await self._exploring_skills_agent.execute(user_input=user_input,
                                                                                       context=context)
                # Update the conversation history
                await self._conversation_manager.update_history(user_input, agent_output)

                # After the agent executes, check again if we should prompt (in case more responsibilities were added)
                # Only check if we haven't already asked and we have enough responsibilities
                if not agent_output.finished:
                    # Check if we should prompt (but don't try to parse response from artificial input)
                    # We'll check again on the next user input
                    responsibilities_count = len(current_experience.experience.responsibilities.responsibilities)
                    if (_ReadinessAssessmentLLM.has_enough_responsibilities(responsibilities_count) and
                        not current_experience.asked_to_continue_to_linking):
                        # We have enough responsibilities and haven't asked yet
                        # We'll prompt on the next turn, for now return the agent output
                        pass

                    # Agent is not finished, return its output
                    return agent_output

                # Agent finished, advance to the next sub-phase
                current_experience.dive_in_phase = DiveInPhase.LINKING_RANKING

        if current_experience.dive_in_phase == DiveInPhase.LINKING_RANKING:
            if current_experience.experience.responsibilities.responsibilities:
                # Infer the occupations for the experience and update the experience entity
                # , then link the skills and rank them
                agent_output = await self._link_and_rank(
                    country_of_user=state.country_of_user,
                    current_experience=current_experience.experience)
                await self._conversation_manager.update_history(AgentInput(
                    message="(silence)",
                    is_artificial=True
                ), agent_output)
                # get the context again after updating the history
                context = await self._conversation_manager.get_conversation_context()
                # completed processing this experience
                current_experience.dive_in_phase = DiveInPhase.PROCESSED
                state.current_experience_uuid = None
            else:
                # if the current experience does not have any responsibilities, then we should skip this experience
                # as there is no information to link and ran, and we should move to the next experience
                current_experience.dive_in_phase = DiveInPhase.PROCESSED
                state.current_experience_uuid = None
                agent_output = AgentOutput(
                    message_for_user=f'I have skipped your experience as "{current_experience.experience.experience_title}" '
                                     f'because you did not share enough details',
                    finished=False,
                    agent_type=self._agent_type,
                    agent_response_time_in_sec=0,
                    llm_stats=[]
                )
                await self._conversation_manager.update_history(AgentInput(
                    message="(silence)",
                    is_artificial=True
                ), agent_output)
                # get the context again after updating the history
                context = await self._conversation_manager.get_conversation_context()

            if current_experience.dive_in_phase == DiveInPhase.PROCESSED:
                # Add the experience to the list of explored experiences
                explored_experience = get_editable_experience(current_experience.experience)
                state.explored_experiences.append(explored_experience)

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
            return await self._dive_into_experiences(user_input=user_input, context=context, state=state)

        # This should never happen, as the phase DiveInPhase.PROCESSED is handled directly after the LINKING_RANKING phase
        self.logger.warning("ExploreExperiencesAgentDirector: Unknown sub-phase")

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
            # get the context again after updating the history
            context = await self._conversation_manager.get_conversation_context()

            # The experiences are still being collected, but we can already store them so that we can
            # present them to the user even if data collection has not finished.
            # The experiences will be overwritten every time, but we preserve responsibilities from CV injection
            experiences = self._collect_experiences_agent.get_experiences()

            # Helper function to normalize strings for matching
            def _normalize(value: str | None) -> str:
                return (value or "").strip().lower()

            # Create a new dict to store updated experiences, preserving existing ones with responsibilities
            new_experiences_state = {}
            for exp in experiences:
                # Try to find existing experience by UUID first (fast path)
                existing_state = state.experiences_state.get(exp.uuid)

                # If not found by UUID, try matching by title/company/location (for CV-injected experiences)
                matched_uuid = exp.uuid  # Default to new experience's UUID
                if not existing_state:
                    exp_key = (
                        _normalize(exp.experience_title),
                        _normalize(exp.company),
                        _normalize(exp.location),
                    )
                    for existing_uuid, existing in state.experiences_state.items():
                        existing_key = (
                            _normalize(existing.experience.experience_title),
                            _normalize(existing.experience.company),
                            _normalize(existing.experience.location),
                        )
                        if existing_key == exp_key:
                            existing_state = existing
                            matched_uuid = existing_uuid  # Use the existing UUID
                            break

                if existing_state and existing_state.experience.responsibilities.responsibilities:
                    # Preserve the existing experience with its responsibilities
                    # Update only the basic fields that might have changed
                    responsibilities_count = len(existing_state.experience.responsibilities.responsibilities)
                    self.logger.debug(
                        "Preserving responsibilities for experience {title=%s, uuid=%s, responsibilities=%d}",
                        exp.experience_title,
                        matched_uuid,
                        responsibilities_count
                    )
                    existing_state.experience.experience_title = exp.experience_title
                    existing_state.experience.company = exp.company
                    existing_state.experience.location = exp.location
                    existing_state.experience.timeline = exp.timeline
                    existing_state.experience.work_type = exp.work_type
                    # Use the matched UUID (preserves CV-injected UUID if matched)
                    new_experiences_state[matched_uuid] = existing_state
                else:
                    # Create a new experience state (no existing one or no responsibilities to preserve)
                    new_experiences_state[exp.uuid] = ExperienceState(experience=exp)

            # Replace the old state with the new one
            state.experiences_state = new_experiences_state

            # If collecting is not finished then return the output to the user to continue collecting
            if not agent_output.finished:
                return agent_output

            # and transition to the next phase
            state.conversation_phase = ConversationPhase.DIVE_IN
            transitioned_between_states = True

        # Then dive into each of the experiences collected
        if state.conversation_phase == ConversationPhase.DIVE_IN:

            if transitioned_between_states:  # TODO this is not needed anymore
                user_input = AgentInput(
                    message="I am ready to dive into my experiences, don't greet me, let's get into it immediately",
                    is_artificial=True)

            # The conversation history is handled in dive_into_experiences method,
            # as there is another transition between sub-phases happening there
            agent_output = await self._dive_into_experiences(user_input=user_input, context=context, state=state)
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
                 experience_pipeline_config: ExperiencePipelineConfig
                 ):
        super().__init__(agent_type=AgentType.EXPLORE_EXPERIENCES_AGENT,
                         is_responsible_for_conversation_history=True)
        self._search_services = search_services
        self._conversation_manager = conversation_manager
        self._state: ExploreExperiencesAgentDirectorState | None = None
        self._collect_experiences_agent = CollectExperiencesAgent()
        self._exploring_skills_agent = SkillsExplorerAgent()
        self._experience_pipeline_config = experience_pipeline_config

    def get_collect_experiences_agent(self) -> CollectExperiencesAgent:
        return self._collect_experiences_agent

    def get_exploring_skills_agent(self) -> SkillsExplorerAgent:
        return self._exploring_skills_agent

    async def _link_and_rank(self, *,
                             country_of_user: Country,
                             current_experience: ExperienceEntity,
                             ) -> AgentOutput:
        start = time.time()
        pipeline = ExperiencePipeline(
            config=self._experience_pipeline_config,
            search_services=self._search_services
        )
        pipline_result = await pipeline.execute(
            experience_title=current_experience.experience_title,
            company_name=current_experience.company,
            work_type=current_experience.work_type,
            # Currently, the country of interest is the same as the user's country.
            # In the future, we may want to change this so that each experience has its own country of interest,
            # for example, if the user has worked in multiple countries.
            country_of_interest=country_of_user,
            responsibilities=current_experience.responsibilities.responsibilities
        )
        current_experience.top_skills = pipline_result.top_skills
        current_experience.remaining_skills = pipline_result.remaining_skills

        # construct a summary of the skills
        skills_summary = "\n"
        if len(current_experience.top_skills) == 0:
            skills_summary += "• No skills identified\n"
        else:
            for skill in current_experience.top_skills:
                skills_summary += f"• {skill.preferredLabel}\n"

        # construct a summary of the experience
        current_experience.summary = await ExperienceSummarizer().execute(
            country_of_user=country_of_user,
            experience_title=current_experience.experience_title,
            company=current_experience.company,
            work_type=current_experience.work_type,
            responsibilities=current_experience.responsibilities.responsibilities,
            top_skills=current_experience.top_skills,
            questions_and_answers=current_experience.questions_and_answers
        )

        agent_output: AgentOutput = AgentOutput(
            message_for_user=f"Based on the information provided about your experience as '{current_experience.experience_title}', "
                             f"here’s a brief overview:\n\n"
                             f"{current_experience.summary}\n\n"
                             f"Top {len(current_experience.top_skills)} skills demonstrated:"
                             f"{skills_summary}",
            finished=False,
            agent_type=self._agent_type,
            agent_response_time_in_sec=round(time.time() - start, 2),
            llm_stats=pipline_result.llm_stats
        )
        return agent_output
