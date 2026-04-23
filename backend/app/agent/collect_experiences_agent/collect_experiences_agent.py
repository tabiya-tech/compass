import asyncio
from typing import Optional, Mapping, Any

from pydantic import BaseModel, Field, field_serializer, field_validator

from app.agent.agent import Agent
from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.agent_types import AgentType
from app.agent.collect_experiences_agent._conversation_llm import _ConversationLLM, ConversationLLMAgentOutput, \
    fill_incomplete_fields_as_declined
from app.agent.persona_detector import PersonaType
from app.agent.collect_experiences_agent._dataextraction_llm import _DataExtractionLLM
from app.agent.collect_experiences_agent._transition_decision_tool import TransitionDecisionTool, TransitionDecision
from app.agent.collect_experiences_agent._types import CollectedData
from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.experience.timeline import Timeline
from app.agent.experience.work_type import WorkType, is_storage_work_type
from app.agent.linking_and_ranking_pipeline import ExperiencePipelineConfig
from app.agent.linking_and_ranking_pipeline.infer_occupation_tool import InferOccupationTool
from app.conversation_memory.conversation_memory_types import ConversationContext
from app.countries import Country
from app.vector_search.esco_entities import OccupationSkillEntity
from app.vector_search.vector_search_dependencies import SearchServices


def _deserialize_work_types(value: list[str] | list[WorkType]) -> list[WorkType]:
    if isinstance(value, list):
        # If the value is a list, and the items in the list are strings, we convert the strings to the Enum
        # Otherwise, we return the value as is
        return [WorkType[x] if isinstance(x, str) else x for x in value]
    return value


def _select_normalized_title(*,
                             original_title: str,
                             contextual_titles: list[str],
                             esco_occupations: list[OccupationSkillEntity]) -> Optional[str]:
    cleaned_original = (original_title or "").strip().lower()
    candidates: list[str] = []

    for title in contextual_titles:
        cleaned = (title or "").strip()
        if cleaned:
            candidates.append(cleaned)
    for occupation_skill in esco_occupations:
        label = occupation_skill.occupation.preferredLabel.strip()
        if label:
            candidates.append(label)

    if not candidates:
        return None

    for candidate in candidates:
        if candidate.lower() != cleaned_original:
            return candidate

    return candidates[0]


class CollectExperiencesAgentState(BaseModel):
    """
    Stores the user-specific state for this agent. Managed centrally.
    """

    session_id: int
    """
    The session id of the conversation.
    """

    country_of_user: Country = Field(default=Country.UNSPECIFIED)
    """
    The country of the user.
    """

    persona_type: PersonaType = Field(default=PersonaType.INFORMAL)
    """
    The detected persona type for adapting prompts.
    """

    collected_data: list[CollectedData] = Field(default_factory=list)
    """
    The data collected during the conversation.
    """

    unexplored_types: list[WorkType] = Field(default_factory=lambda: [WorkType.PAID_WORK,
                                                                      WorkType.UNPAID_WORK])
    """
    The types of work experiences that have not been explored yet.
    """

    explored_types: list[WorkType] = Field(default_factory=list)
    """
    The questions asked by the conversational LLM.
    """

    first_time_visit: bool = True
    """
    Whether this is the first time the agent is visited during the conversation.
    """

    class Config:
        """
        Disallow extra fields in the model
        """
        extra = "forbid"

    @field_serializer("country_of_user")
    def serialize_country_of_user(self, country_of_user: Country, _info):
        return country_of_user.name

    @field_validator("country_of_user", mode='before')
    def deserialize_country_of_user(cls, value: str | Country) -> Country:
        if isinstance(value, str):
            return Country[value]
        return value

    @field_serializer("persona_type")
    def serialize_persona_type(self, persona_type: PersonaType, _info):
        return persona_type.name

    @field_validator("persona_type", mode='before')
    def deserialize_persona_type(cls, value: str | PersonaType) -> PersonaType:
        if isinstance(value, str):
            return PersonaType[value]
        return value

    # use a field serializer to serialize the explored_types
    # we use the name of the Enum instead of the value because that makes the code less brittle
    @field_serializer("explored_types")
    def serialize_explored_types(self, explored_types: list[WorkType], _info):
        # We serialize the explored_types to a list of strings (the names of the Enum)
        return [x.name for x in explored_types]

    # Deserialize the explored_types from the enum name
    @field_validator("explored_types", mode='before')
    def deserialize_explored_types(cls, value: list[str] | list[WorkType]) -> list[WorkType]:
        return _deserialize_work_types(value)

    # use a field serializer to serialize the unexplored_types
    # we use the name of the Enum instead of the value because that makes the code less brittle
    @field_serializer("unexplored_types")
    def serialize_unexplored_types(self, unexplored_types: list[WorkType], _info):
        # We serialize the unexplored_types to a list of strings (the names of the Enum)
        return [x.name for x in unexplored_types]

    # Deserialize the unexplored_types from the enum name
    @field_validator("unexplored_types", mode='before')
    def deserialize_unexplored_types(cls, value: list[str] | list[WorkType]) -> list[WorkType]:
        return _deserialize_work_types(value)

    @staticmethod
    def from_document(_doc: Mapping[str, Any]) -> "CollectExperiencesAgentState":
        return CollectExperiencesAgentState(session_id=_doc["session_id"],
                                            # For backward compatibility with old documents that don't have the country_of_user field, set it to UNSPECIFIED
                                            country_of_user=_doc.get("country_of_user", Country.UNSPECIFIED),
                                            persona_type=_doc.get("persona_type", PersonaType.INFORMAL),
                                            collected_data=_doc["collected_data"],
                                            unexplored_types=_doc["unexplored_types"],
                                            explored_types=_doc["explored_types"],
                                            first_time_visit=_doc["first_time_visit"])


class CollectExperiencesAgent(Agent):
    """
    This agent converses with user and collects basic information about their work experiences.
    """

    def __init__(self,
                 *,
                 search_services: SearchServices | None = None,
                 experience_pipeline_config: ExperiencePipelineConfig | None = None):
        super().__init__(agent_type=AgentType.COLLECT_EXPERIENCES_AGENT,
                         is_responsible_for_conversation_history=False)
        self._experiences: list[ExperienceEntity] = []
        self._state: Optional[CollectExperiencesAgentState] = None
        self._search_services = search_services
        self._experience_pipeline_config = experience_pipeline_config

    async def _normalize_experience_titles(self, *, collected_data: list[CollectedData]):
        if not self._search_services or self._state is None:
            return

        config = self._experience_pipeline_config or ExperiencePipelineConfig()
        infer_tool = InferOccupationTool(
            occupation_skill_search_service=self._search_services.occupation_skill_search_service,
            occupation_search_service=self._search_services.occupation_search_service
        )

        targets: list[CollectedData] = []
        tasks = []
        for elem in collected_data:
            if not elem.experience_title or elem.normalized_experience_title:
                continue
            targets.append(elem)
            tasks.append(infer_tool.execute(
                experience_title=elem.experience_title,
                company=elem.company,
                work_type=WorkType.from_string_key(elem.work_type),
                responsibilities=[],
                country_of_interest=self._state.country_of_user,
                number_of_titles=config.number_of_occupation_alt_titles,
                top_k=config.number_of_occupations_per_cluster,
                top_p=config.number_of_occupations_candidates_per_title
            ))

        if not tasks:
            return

        results = await asyncio.gather(*tasks, return_exceptions=True)
        for elem, result in zip(targets, results):
            if isinstance(result, Exception):
                self.logger.warning("Failed to infer normalized title for '%s': %s",
                                    elem.experience_title, result)
                continue
            normalized_title = _select_normalized_title(
                original_title=elem.experience_title,
                contextual_titles=result.contextual_titles,
                esco_occupations=result.esco_occupations
            )
            if normalized_title:
                elem.normalized_experience_title = normalized_title

    def _prune_stale_orphan_experiences(
        self,
        *,
        last_referenced_experience_index: int,
        current_turn_count: int,
    ) -> int:
        """
        Remove titleless experiences that were created in a previous turn.

        Such entries are data-extraction artifacts (a fleeting mention that never got
        named, or a phantom left behind because a later ADD created a sibling instead
        of updating it). They cannot be meaningfully completed and would otherwise
        block work-type transitions via _find_incomplete_required_for_work_type.

        Fresh titleless entries (defined_at_turn_number >= current turn count) are
        preserved so the conversation LLM can ask for a title in its response.

        Returns the (possibly re-mapped) last_referenced_experience_index.
        """
        collected_data = self._state.collected_data

        def _is_keepable(exp: CollectedData) -> bool:
            if exp.experience_title and exp.experience_title.strip():
                return True
            if exp.defined_at_turn_number is not None and exp.defined_at_turn_number >= current_turn_count:
                return True
            return False

        if all(_is_keepable(exp) for exp in collected_data):
            return last_referenced_experience_index

        last_ref_uuid = (
            collected_data[last_referenced_experience_index].uuid
            if 0 <= last_referenced_experience_index < len(collected_data)
            else None
        )
        pruned_count = sum(1 for exp in collected_data if not _is_keepable(exp))
        kept = [exp for exp in collected_data if _is_keepable(exp)]
        for new_idx, exp in enumerate(kept):
            exp.index = new_idx
        self._state.collected_data = kept
        self.logger.info(
            "Pruned %d stale orphan experience(s) without titles (current turn count=%d).",
            pruned_count, current_turn_count,
        )

        if last_ref_uuid is None:
            return -1
        for i, exp in enumerate(kept):
            if exp.uuid == last_ref_uuid:
                return i
        return -1

    def set_state(self, state: CollectExperiencesAgentState):
        """
        Set the state of the agent.
        This method should be called before the agent's execute() method is called.
        """
        self._state = state

    async def execute(self, user_input: AgentInput,
                      context: ConversationContext) -> AgentOutput:

        if self._state is None:
            raise ValueError("CollectExperiencesAgent: execute() called before state was initialized")

        collected_data = self._state.collected_data
        last_referenced_experience_index = -1
        data_extraction_llm_stats = []
        if user_input.message == "":
            # If the user input is empty, set it to "(silence)"
            # This is to avoid the agent failing to respond to an empty input
            user_input.message = "(silence)"
        else:
            # The data extraction LLM is responsible for extracting the experience data from the conversation
            data_extraction_llm = _DataExtractionLLM(self.logger)
            # TODO: the LLM can and will fail with an exception or even return None, we need to handle this
            last_referenced_experience_index, data_extraction_llm_stats = await data_extraction_llm.execute(user_input=user_input,
                                                                                                            context=context,
                                                                                                            collected_experience_data_so_far=collected_data)
        # Prune stale orphan experiences — titleless entries defined in a previous turn.
        # Without this, a phantom (created when the user first mentions an experience but
        # never gets a title assigned — e.g. because a later ADD created a sibling entry
        # instead of updating it) traps TransitionDecisionTool in perpetual CONTINUE,
        # because _find_incomplete_required_for_work_type treats missing titles as a
        # blocker. Fresh titleless entries from this turn are kept — the conversation LLM
        # is presumed to be asking for the title right now.
        last_referenced_experience_index = self._prune_stale_orphan_experiences(
            last_referenced_experience_index=last_referenced_experience_index,
            current_turn_count=len(context.all_history.turns),
        )
        collected_data = self._state.collected_data

        await self._normalize_experience_titles(collected_data=collected_data)
        # TODO: Keep track of the last_referenced_experience_index and if it has changed it means that the user has
        #   provided a new experience, we need to handle this as
        #   a) if the user has not finished with the previous one we should ask them to complete it first
        #   b) the model may have made a mistake interpreting the user input as we need to clarify
        conversation_llm = _ConversationLLM()
        exploring_type = self._state.unexplored_types[0] if len(self._state.unexplored_types) > 0 else None

        transition_decision_tool = TransitionDecisionTool(self.logger)

        # Both are pure readers of collected_data/context/user_input -- safe to parallelize
        conversation_llm_output, (transition_decision, transition_reasoning, transition_llm_stats) = await asyncio.gather(
            conversation_llm.execute(
                first_time_visit=self._state.first_time_visit,
                context=context,
                user_input=user_input,
                country_of_user=self._state.country_of_user,
                persona_type=self._state.persona_type,
                collected_data=collected_data,
                last_referenced_experience_index=last_referenced_experience_index,
                exploring_type=exploring_type,
                unexplored_types=self._state.unexplored_types,
                explored_types=self._state.explored_types,
                logger=self.logger),
            transition_decision_tool.execute(
                collected_data=collected_data,
                exploring_type=exploring_type,
                unexplored_types=self._state.unexplored_types,
                explored_types=self._state.explored_types,
                conversation_context=context,
                user_input=user_input)
        )

        self._state.first_time_visit = False

        conversation_llm_output.llm_stats = data_extraction_llm_stats + conversation_llm_output.llm_stats + transition_llm_stats
        reasoning_text = transition_reasoning.reasoning if transition_reasoning else "No reasoning provided"

        if transition_decision == TransitionDecision.END_WORKTYPE:
            did_update = False
            # if decision is to end the exploration of the current work type, we update null fields to ""
            if exploring_type is not None and exploring_type in self._state.unexplored_types:
                fill_incomplete_fields_as_declined(
                    self._state.collected_data, exploring_type
                )
                self._state.unexplored_types.remove(exploring_type)
                self._state.explored_types.append(exploring_type)
                did_update = True
                self.logger.info(
                    "Transition decision: END_WORKTYPE - Explored work type: %s"
                    "\n  - remaining types: %s"
                    "\n  - discovered experiences so far: %s"
                    "\n  - reasoning: %s",
                    exploring_type,
                self._state.unexplored_types,
                self._state.collected_data,
                reasoning_text
            )
            if not self._state.unexplored_types:
                conversation_llm_output.finished = True
                self.logger.info(
                    "Transition decision: END_WORKTYPE with no unexplored types - treating as END_CONVERSATION"
                )
                return conversation_llm_output

        elif transition_decision == TransitionDecision.END_CONVERSATION:
            conversation_llm_output.finished = True
            self.logger.info(
                "Transition decision: END_CONVERSATION"
                "\n  - all phases explored: %s"
                "\n  - discovered experiences: %s"
                "\n  - reasoning: %s",
                len(self._state.explored_types) == 2,
                self._state.collected_data,
                reasoning_text
            )
        elif transition_decision == TransitionDecision.CONTINUE:
            self.logger.info(
                "Transition decision: CONTINUE"
                "\n  - exploring type: %s"
                "\n  - unexplored types: %s"
                "\n  - collected experiences: %d"
                "\n  - reasoning: %s",
                exploring_type.name if exploring_type else "None",
                [wt.name for wt in self._state.unexplored_types],
                len(collected_data),
                reasoning_text
            )

        return conversation_llm_output

    def get_experiences(self) -> list[ExperienceEntity]:
        """
        Get the experiences extracted by the agent.
        If this method is called before the agent has finished its task, the list will be empty or incomplete.
        Only includes experiences with a storage work type (not phase-only PAID_WORK/UNPAID_WORK).
        """
        experiences = []
        # The conversation is completed when the LLM has finished and all work types have been explored
        for elem in self._state.collected_data:
            self.logger.debug("Experience data collected: %s", elem)
            wt = WorkType.from_string_key(elem.work_type)
            if not is_storage_work_type(wt):
                continue
            try:
                entity = ExperienceEntity(
                    uuid=elem.uuid if elem.uuid else None,
                    experience_title=elem.experience_title if elem.experience_title else '',
                    normalized_experience_title=elem.normalized_experience_title,
                    company=elem.company,
                    location=elem.location,
                    timeline=Timeline(start=elem.start_date, end=elem.end_date),
                    work_type=wt
                )
                experiences.append(entity)
            except Exception as e:  # pylint: disable=broad-except
                self.logger.warning("Could not parse experience entity from: %s. Error: %s", elem, e)

        return experiences
