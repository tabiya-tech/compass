import logging

from app.agent.collect_experiences_agent._types import CollectedData
from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.explore_experiences_agent_director import ExperienceState, DiveInPhase, ConversationPhase
from app.application_state import ApplicationState, IApplicationStateManager
from app.users.cv.types import CVStructuredExtraction


class IStateInjectionService:
    """Interface for state injection service."""
    
    async def inject_cv_data(
        self, 
        *, 
        user_id: str, 
        session_id: int, 
        structured_extraction: CVStructuredExtraction
    ) -> bool:
        """
        Inject CV structured extraction data into agent states.
        
        :param user_id: The user ID
        :param session_id: The session ID
        :param structured_extraction: The structured extraction data to inject
        :return: True if injection was successful, False otherwise
        """
        raise NotImplementedError()


class StateInjectionService(IStateInjectionService):
    """
    Service for injecting CV structured extraction data into agent states.
    
    This service is designed to be reusable for future API endpoints and
    ensures that CV data is properly integrated into the Compass flow
    without disrupting existing functionality.
    """
    
    def __init__(self, application_state_manager: IApplicationStateManager):
        self._application_state_manager = application_state_manager
        self._logger = logging.getLogger(self.__class__.__name__)
    
    async def inject_cv_data(
        self, 
        *, 
        user_id: str, 
        session_id: int, 
        structured_extraction: CVStructuredExtraction
    ) -> bool:
        """
        Inject CV structured extraction data into agent states.
        
        :param user_id: The user ID
        :param session_id: The session ID
        :param structured_extraction: The structured extraction data to inject
        :return: True if injection was successful, False otherwise
        """
        try:
            self._logger.info("Starting CV data injection for user %s, session %s", user_id, session_id)
            
            # Get current application state
            state = await self._application_state_manager.get_state(session_id)
            
            # Inject into CollectExperiencesAgent state
            await self._inject_to_collect_experiences_agent(state, structured_extraction.collected_data)
            
            # Inject into ExploreExperiencesAgent state
            await self._inject_to_explore_experiences_agent(state, structured_extraction.experience_entities)
            
            # Inject into SkillsExplorerAgent state
            await self._inject_to_skills_explorer_agent(state, structured_extraction.experience_entities)
            
            # Save updated state
            await self._application_state_manager.save_state(state)
            
            self._logger.info("Successfully injected CV data into agent states for user %s, session %s", user_id, session_id)
            return True
            
        except Exception as e:
            self._logger.error("Failed to inject CV data into agent states: %s", e)
            return False
    
    async def _inject_to_collect_experiences_agent(
        self, 
        state: ApplicationState, 
        collected_data: list[CollectedData]
    ):
        """Inject data into CollectExperiencesAgent state without disrupting existing flow."""
        
        # Add new collected data to existing state
        state.collect_experience_state.collected_data.extend(collected_data)
        
        # Mark that experiences have been collected from CV
        state.collect_experience_state.first_time_visit = False
        
        self._logger.debug("Injected %d collected data items into CollectExperiencesAgent state", len(collected_data))
    
    async def _inject_to_explore_experiences_agent(
        self, 
        state: ApplicationState, 
        experience_entities: list[ExperienceEntity]
    ):
        """
        Inject ExperienceEntity objects into ExploreExperiencesAgent state.
        
        This allows the existing skills processing pipeline to handle
        the experiences through normal Compass flow.
        """
        
        # Add experiences to the experiences_state dict
        for experience in experience_entities:
            has_responsibilities = bool(
                experience.responsibilities
                and experience.responsibilities.responsibilities
            )

            try:
                resp_count = len(experience.responsibilities.responsibilities) if experience.responsibilities else 0
            except Exception:  # defensive
                resp_count = 0
            self._logger.info(
                "Injection check for experience {title=%s, uuid=%s, responsibilities=%d}",
                getattr(experience, "experience_title", None),
                getattr(experience, "uuid", None),
                resp_count,
            )

            _existing_key, existing_state = self._find_existing_experience(state, experience)

            if existing_state:
                if has_responsibilities:
                    responsibilities_bullets = "\n".join(
                        f"• {resp.strip()}" for resp in experience.responsibilities.responsibilities if resp.strip()
                    )
                    if responsibilities_bullets:
                        justification_question = (
                            "These responsibilities were captured from your CV upload. Please confirm they look right."
                        )
                        justification_answer = responsibilities_bullets
                        existing_state.experience.questions_and_answers = list(existing_state.experience.questions_and_answers)
                        if (justification_question, justification_answer) not in existing_state.experience.questions_and_answers:
                            existing_state.experience.questions_and_answers.append((justification_question, justification_answer))
                    # Update responsibilities if previously missing
                    if not existing_state.experience.responsibilities.responsibilities:
                        existing_state.experience.responsibilities = experience.responsibilities
                continue

            # Ensure questions_and_answers captures CV-derived responsibilities as justification
            if has_responsibilities:
                responsibilities_bullets = "\n".join(
                    f"• {resp.strip()}" for resp in experience.responsibilities.responsibilities if resp.strip()
                )
                if responsibilities_bullets:
                    justification_question = (
                        "These responsibilities were captured from your CV upload. Please confirm they look right."
                    )
                    justification_answer = responsibilities_bullets
                    experience.questions_and_answers = list(experience.questions_and_answers)
                    experience.questions_and_answers.append((justification_question, justification_answer))

            # Store with NOT_STARTED; we will let the normal flow advance sub-phases
            experience_state = ExperienceState(
                dive_in_phase=DiveInPhase.NOT_STARTED,
                experience=experience
            )

            state.explore_experiences_director_state.experiences_state[experience.uuid] = experience_state
        
        self._logger.debug("Injected %d experience entities into ExploreExperiencesAgent state", len(experience_entities))
    
    async def _inject_to_skills_explorer_agent(
        self, 
        state: ApplicationState, 
        experience_entities: list[ExperienceEntity]
    ):
        """
        Inject experience entities into SkillsExplorerAgent state.
        
        This ensures that the Skills Explorer Agent knows about the experiences
        that were injected from the CV and that they have responsibilities data.
        """
        
        # Add experiences to the experiences_explored list
        for experience in experience_entities:
            has_responsibilities = bool(
                experience.responsibilities
                and experience.responsibilities.responsibilities
            )

            if has_responsibilities:
                # These experiences can skip the exploratory questioning phase and go straight to linking/ranking
                structured_summary = ExperienceEntity.get_structured_summary(
                    experience_title=experience.experience_title,
                    company=experience.company,
                    location=experience.location,
                    work_type=experience.work_type.name if experience.work_type else None,
                    start_date=experience.timeline.start if experience.timeline else None,
                    end_date=experience.timeline.end if experience.timeline else None
                )

                if structured_summary not in state.skills_explorer_agent_state.experiences_explored:
                    state.skills_explorer_agent_state.experiences_explored.append(structured_summary)

                state.skills_explorer_agent_state.first_time_for_experience[experience.uuid] = False
            else:
                # Allow the skill explorer to treat this as a fresh experience (retain first-time behaviour)
                state.skills_explorer_agent_state.first_time_for_experience.pop(experience.uuid, None)
        
        self._logger.debug("Injected %d experience entities into SkillsExplorerAgent state", len(experience_entities))

    def _find_existing_experience(self, state: ApplicationState, experience: ExperienceEntity) -> tuple[str, ExperienceState] | tuple[None, None]:
        def _normalize(value: str | None) -> str:
            return (value or "").strip().lower()

        target = (
            _normalize(experience.experience_title),
            _normalize(experience.company),
            _normalize(experience.location),
        )

        for key, existing in state.explore_experiences_director_state.experiences_state.items():
            candidate = (
                _normalize(existing.experience.experience_title),
                _normalize(existing.experience.company),
                _normalize(existing.experience.location),
            )
            if candidate == target:
                return key, existing

        return None, None
