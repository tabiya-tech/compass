from enum import Enum
from typing import Optional, Mapping, Any
import logging
import time
from pydantic import BaseModel, field_serializer, field_validator, Field

from app.agent.agent import Agent
from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.agent_types import AgentType
from app.agent.collect_experiences_agent import CollectExperiencesAgent
from app.agent.experience._experience_summarizer import ExperienceSummarizer
from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.experience.upgrade_experience import get_editable_experience
from app.agent.linking_and_ranking_pipeline import ExperiencePipeline, ExperiencePipelineConfig
from app.agent.linking_and_ranking_pipeline.experience_pipeline import ClusterPipelineResult
from app.agent.skill_explorer_agent import SkillsExplorerAgent, SkillsExplorerAgentState
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager, IConversationMemoryManager
from app.server_config import REPETITION_SHORT_CIRCUIT_THRESHOLD
from app.conversation_memory.conversation_memory_types import \
    ConversationContext
from app.countries import Country
from app.vector_search.esco_entities import SkillEntity
from app.i18n.translation_service import t
from app.vector_search.vector_search_dependencies import SearchServices


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
                message_for_user=t("messages", "exploreExperiences.transitionToPreferences"),
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
            # The agent will explore the skills for the experience and update the experience entity
            self._exploring_skills_agent.set_experience(current_experience.experience)
            agent_output: AgentOutput = await self._exploring_skills_agent.execute(user_input=user_input, context=context)
            # Update the conversation history
            await self._conversation_manager.update_history(user_input, agent_output)
            # Detect consecutive repetition in the agent's question list and flush the
            # visible window if the threshold is exceeded, so the LLM won't pattern-match
            # to repeated verbatim turns on the next call.
            await _flush_if_repeating(
                self._exploring_skills_agent.state,
                self._conversation_manager,
                self.logger,
            )
            # get the context again after updating the history
            context = await self._conversation_manager.get_conversation_context()
            if not agent_output.finished:
                return agent_output

            # advance to the next sub-phase
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
                    message_for_user=t(
                        "messages",
                        "exploreExperiences.skippedExperienceMissingDetails",
                        experience_title=current_experience.experience.experience_title,
                    ),
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
                transition_message = AgentOutput(
                    message_for_user=t("messages", "exploreExperiences.transitionToPreferences"),
                    finished=True,
                    agent_type=self._agent_type,
                    agent_response_time_in_sec=0,
                    llm_stats=[]
                )
                await self._conversation_manager.update_history(
                    AgentInput(message="", is_artificial=True),
                    transition_message,
                )
                return transition_message

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

            # The experiences are still being collected, but we can already store them so that we can
            # present them to the user even if data collection has not finished.
            # The experiences will be overwritten every time
            experiences = self._collect_experiences_agent.get_experiences()
            state.experiences_state.clear()
            for exp in experiences:
                state.experiences_state[exp.uuid] = ExperienceState(experience=exp)

            # If collecting is not finished then return the output to the user to continue collecting
            if not agent_output.finished:
                # Only save to history when not transitioning, so the next agent's
                # opening message is the first thing the user sees on transition.
                await self._conversation_manager.update_history(user_input, agent_output)
                # get the context again after updating the history
                context = await self._conversation_manager.get_conversation_context()
                return agent_output

            # and transition to the next phase — do NOT save the outgoing agent's final response;
            # the dive-in agent will produce the first message the user sees.
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
        self._collect_experiences_agent = CollectExperiencesAgent(
            search_services=search_services,
            experience_pipeline_config=experience_pipeline_config
        )
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
        normalized_title = _select_normalized_title(
            original_title=current_experience.experience_title,
            cluster_results=pipline_result.cluster_results
        )
        if normalized_title:
            current_experience.normalized_experience_title = normalized_title
        display_title = current_experience.normalized_experience_title or current_experience.experience_title

        # construct a summary of the skills
        skills_summary = "\n"
        if len(current_experience.top_skills) == 0:
            skills_summary += f"• {t('messages', 'exploreExperiences.noSkillsIdentified')}\n"
        else:
            for skill in current_experience.top_skills:
                skills_summary += f"• {skill.preferredLabel}\n"

        # construct a summary of the experience
        current_experience.summary = await ExperienceSummarizer().execute(
            country_of_user=country_of_user,
            experience_title=display_title,
            company=current_experience.company,
            work_type=current_experience.work_type,
            responsibilities=current_experience.responsibilities.responsibilities,
            top_skills=current_experience.top_skills,
            questions_and_answers=current_experience.questions_and_answers
        )

        agent_output: AgentOutput = AgentOutput(
            message_for_user=t(
                "messages",
                "exploreExperiences.linkAndRank.summaryMessage",
                experience_title=display_title,
                summary=current_experience.summary,
                top_count=len(current_experience.top_skills),
                skills_summary=skills_summary,
            ),
            finished=False,
            agent_type=self._agent_type,
            agent_response_time_in_sec=round(time.time() - start, 2),
            llm_stats=pipline_result.llm_stats
        )
        return agent_output


async def _flush_if_repeating(
    state: SkillsExplorerAgentState | None,
    conversation_manager: IConversationMemoryManager,
    logger: logging.Logger,
) -> None:
    """
    Detect REPETITION_SHORT_CIRCUIT_THRESHOLD consecutive identical trailing entries in
    question_asked_until_now. If found, force-summarize the entire visible history so
    the LLM no longer sees the repeated turns verbatim on the next call, and deduplicate
    question_asked_until_now down to one copy of the repeated message.
    Only consecutive repetition at the tail is considered — non-consecutive repetition
    (e.g. the same transitional question asked legitimately for two different experiences
    several turns apart) is left alone.
    """
    if state is None:
        return
    questions = state.question_asked_until_now
    if len(questions) < REPETITION_SHORT_CIRCUIT_THRESHOLD:
        return
    last = questions[-1]
    consecutive = 0
    for q in reversed(questions):
        if q == last:
            consecutive += 1
        else:
            break
    if consecutive < REPETITION_SHORT_CIRCUIT_THRESHOLD:
        return

    logger.warning(
        "Detected %d consecutive identical agent messages in question_asked_until_now — "
        "force-summarizing visible history to break the loop. Message: %r",
        consecutive,
        last[:120],
    )
    await conversation_manager.force_summarize_all()
    # Deduplicate: keep one copy of the repeated question so the NEVER re-ask rule still fires
    state.question_asked_until_now = questions[:-consecutive] + [last]
    # Trim answers_provided to stay in sync with the new question list length
    new_len = len(state.question_asked_until_now)
    if len(state.answers_provided) > new_len:
        state.answers_provided = state.answers_provided[:new_len]


def _select_normalized_title(*,
                             original_title: str,
                             cluster_results: list[ClusterPipelineResult]) -> str | None:
    cleaned_original = (original_title or "").strip().lower()
    candidates: list[str] = []

    for cluster_result in cluster_results:
        for title in cluster_result.contextual_titles:
            cleaned = title.strip()
            if cleaned:
                candidates.append(cleaned)
        for occupation_skill in cluster_result.esco_occupations:
            label = occupation_skill.occupation.preferredLabel.strip()
            if label:
                candidates.append(label)

    if not candidates:
        return None

    for candidate in candidates:
        if candidate.lower() != cleaned_original:
            return candidate

    return candidates[0]
