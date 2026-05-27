"""
Concerns Phase Handler for the Recommender/Advisor Agent.

Handles the ADDRESS_CONCERNS phase where we respond to user
resistance and objections using appropriate strategies.

Uses two-step LLM process:
1. Classify resistance type
2. Generate appropriate response based on classification
"""

from app.agent.agent_types import LLMStats
from app.agent.llm_caller import LLMCaller
from app.agent.recommender_advisor_agent.state import RecommenderAdvisorAgentState
from app.agent.recommender_advisor_agent.types import (
    ConversationPhase,
    ConcernRecord,
    ResistanceType,
)
from app.agent.recommender_advisor_agent.llm_response_models import (
    ConversationResponse,
    ResistanceClassification,
)
from app.agent.recommender_advisor_agent.phase_handlers.base_handler import BasePhaseHandler
from app.agent.recommender_advisor_agent.prompts import (
    ADDRESS_CONCERNS_PROMPT_CLASSIFICATION,
    ADDRESS_CONCERNS_PROMPT_RESPONSE,
    build_context_block
)
from app.agent.simple_llm_agent.prompt_response_template import get_json_response_instructions
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.conversation_memory.conversation_memory_manager import ConversationContext
from common_libs.llm.generative_models import GeminiGenerativeLLM


class ConcernsPhaseHandler(BasePhaseHandler):
    """
    Handles the ADDRESS_CONCERNS phase.

    Responsibilities:
    - Classify the type of resistance (belief, salience, effort, etc.)
    - Generate appropriate responses without manipulation
    - Track concerns raised and addressed
    - Know when to transition to action planning or pivot
    """

    def __init__(
        self,
        conversation_llm: GeminiGenerativeLLM,
        conversation_caller: LLMCaller[ConversationResponse],
        resistance_caller: LLMCaller[ResistanceClassification],
        intent_classifier=None,
        action_handler: 'ActionPhaseHandler' = None,
        recommendation_interface=None,
        **kwargs
    ):
        """
        Initialize the concerns handler.

        Args:
            resistance_caller: LLM caller for resistance classification
            intent_classifier: Optional intent classifier for detecting non-concern intents
            action_handler: Optional action handler for immediate delegation
            recommendation_interface: Optional interface for re-fetching recommendations
        """
        super().__init__(conversation_llm, conversation_caller, **kwargs)
        self._resistance_caller = resistance_caller
        self._intent_classifier = intent_classifier
        self._action_handler = action_handler
        self._recommendation_interface = recommendation_interface

    async def handle(
        self,
        user_input: str,
        state: RecommenderAdvisorAgentState,
        context: ConversationContext
    ) -> tuple[ConversationResponse, list[LLMStats]]:
        """
        Handle addressing user concerns/resistance.
        """
        all_llm_stats: list[LLMStats] = []

        # FIRST: We wanna check if user is NOT expressing a concern, but rather requesting something else
        # (e.g., "what if i want to become a boda guy?" - switching to different recommendation)
        if self._intent_classifier:
            intent, intent_stats = await self._intent_classifier.classify_intent(
                user_input=user_input,
                state=state,
                context=context,
                phase=ConversationPhase.ADDRESS_CONCERNS,
                llm=self._conversation_llm,
                logger=self.logger
            )
            all_llm_stats.extend(intent_stats)

            if intent:
                # GUARDRAIL: Check for off-recommendation requests
                if intent.intent == "request_outside_recommendations":
                    self.logger.warning(
                        "GUARDRAIL TRIGGERED in CONCERNS: User requested occupation "
                        "outside recommendations: %s", intent.requested_occupation_name
                    )
                    return await self._handle_request_outside_recommendations(
                        requested_occupation_name=intent.requested_occupation_name or "that occupation",
                        user_input=user_input,
                        state=state,
                        context=context
                    )

                # Handle user wanting to explore a different occupation FROM recommendations
                if intent.intent == "explore_occupation" and (intent.target_recommendation_id or intent.target_occupation_index):
                    self.logger.info(f"User wants to switch to different recommendation during concerns phase")
                    # Transition to CAREER_EXPLORATION for the new occupation
                    target_occ = None
                    if intent.target_occupation_index and state.recommendations:
                        idx = intent.target_occupation_index - 1
                        occupations = state.recommendations.occupation_recommendations
                        if 0 <= idx < len(occupations):
                            target_occ = occupations[idx]
                    elif intent.target_recommendation_id:
                        target_occ = state.get_recommendation_by_id(intent.target_recommendation_id)

                    if target_occ:
                        state.current_focus_id = target_occ.uuid
                        state.current_recommendation_type = "occupation"
                        state.conversation_phase = ConversationPhase.CAREER_EXPLORATION

                        return ConversationResponse(
                            reasoning=f"User wants to explore {target_occ.occupation} instead, transitioning to CAREER_EXPLORATION",
                            message=f"Okay, let's explore the {target_occ.occupation} option instead.",
                            finished=False
                        ), all_llm_stats

                # Handle blanket rejection of all recommendations
                if intent.intent == "reject":
                    return await self._handle_blanket_rejection(state)

                # If user accepted/agreed, move to action planning
                if intent.intent == "accept":
                    self.logger.info("User accepted/understood concern discussion, moving to ACTION_PLANNING")
                    state.conversation_phase = ConversationPhase.ACTION_PLANNING

                    # If we have an action handler, immediately invoke it for seamless transition
                    if self._action_handler:
                        self.logger.info("Immediately invoking action handler for seamless experience")
                        return await self._action_handler.handle(user_input, state, context)

                    # Fallback if no action handler available
                    return ConversationResponse(
                        reasoning="User accepted/understood, transitioning to action planning (no handler available)",
                        message="Great! Let's talk about next steps.",
                        finished=False
                    ), all_llm_stats

        # SECOND: If no routing intent detected, classify the resistance type
        classification, llm_stats = await self._classify_resistance(user_input, context)
        all_llm_stats.extend(llm_stats)

        # Check if classification failed
        if classification is None:
            self.logger.error("Resistance classification failed after all retries, using fallback")
            # Fallback: treat as generic concern
            concern = ConcernRecord(
                item_id=state.current_focus_id or "unknown",
                item_type=state.current_recommendation_type,
                concern=user_input,
                resistance_type=ResistanceType.BELIEF_BASED  # Default to belief-based
            )
            state.add_concern(concern)

            return ConversationResponse(
                reasoning="Classification failed, providing generic supportive response",
                message="I hear your concern. Can you tell me more about what specifically worries you? That will help me address it better.",
                finished=False
            ), all_llm_stats

        # If user shows acceptance, transition to action planning
        if classification.resistance_type == "acceptance":
            state.conversation_phase = ConversationPhase.ACTION_PLANNING

            # If we have an action handler, immediately invoke it for seamless transition
            if self._action_handler:
                self.logger.info("User showed acceptance, immediately invoking action handler")
                return await self._action_handler.handle(user_input, state, context)

            # Fallback if no action handler available - offer choices
            occupation_name = "this path"
            if state.current_focus_id:
                rec = state.get_recommendation_by_id(state.current_focus_id)
                if rec and hasattr(rec, 'occupation'):
                    occupation_name = rec.occupation

            return ConversationResponse(
                reasoning="User showed acceptance, transitioning to action planning (no handler available)",
                message=f"Great! I'm glad that's helpful. What would you like to do next?\n\n"
                        f"1. **Discuss next steps** for {occupation_name} (how to apply, prepare, etc.)\n"
                        f"2. **Explore other career options** from your recommendations\n"
                        f"3. **Keep discussing** any remaining concerns\n\n"
                        f"Which option sounds best to you?",
                finished=False
            ), all_llm_stats

        # If no resistance, transition to action planning
        if classification.resistance_type == "none":
            state.conversation_phase = ConversationPhase.ACTION_PLANNING

            # If we have an action handler, immediately invoke it for seamless transition
            if self._action_handler:
                self.logger.info("No resistance detected, immediately invoking action handler")
                return await self._action_handler.handle(user_input, state, context)

            # Fallback if no action handler available
            return ConversationResponse(
                reasoning="No resistance detected, transitioning to action planning (no handler available)",
                message="Great! It sounds like this path interests you. Let's talk about next steps.",
                finished=False
            ), all_llm_stats

        # Record the concern
        # Normalize resistance type: LLM returns "BELIEF-BASED" but enum expects "belief"
        resistance_type_normalized = classification.resistance_type.lower().replace("-based", "").replace("_based", "")

        concern = ConcernRecord(
            item_id=state.current_focus_id or "unknown",
            item_type=state.current_recommendation_type,
            concern=classification.concern_summary,
            resistance_type=ResistanceType(resistance_type_normalized)
        )
        state.add_concern(concern)

        # Generate response based on resistance type
        response, llm_stats = await self._generate_response(
            classification, user_input, state, context
        )
        all_llm_stats.extend(llm_stats)

        return response, all_llm_stats

    async def _classify_resistance(
        self,
        user_input: str,
        context: ConversationContext
    ) -> tuple[ResistanceClassification, list[LLMStats]]:
        """
        Classify the type of user resistance using comprehensive prompt.

        Step 1 of 2-step process.
        """
        # Use the comprehensive classification prompt with proper schema instructions
        schema_instructions = """
Your response must be a JSON object with the following schema:
{
    "reasoning": "Step by step explanation of what type of resistance this is",
    "resistance_type": "One of: belief, salience, effort, financial, circumstantial, none",
    "concern_summary": "Brief summary of the user's concern"
}

Always return a valid JSON object matching this exact schema.
"""

        full_prompt = ADDRESS_CONCERNS_PROMPT_CLASSIFICATION + "\n\n" + schema_instructions

        return await self._resistance_caller.call_llm(
            llm=self._conversation_llm,
            llm_input=ConversationHistoryFormatter.format_for_agent_generative_prompt(
                model_response_instructions=full_prompt,
                context=context,
                user_input=user_input,
            ),
            logger=self.logger
        )

    async def _generate_response(
        self,
        classification: ResistanceClassification,
        user_input: str,
        state: RecommenderAdvisorAgentState,
        context: ConversationContext
    ) -> tuple[ConversationResponse, list[LLMStats]]:
        """
        Generate a response to the user's resistance.

        Step 2 of 2-step process. Uses full context and comprehensive response strategies.
        """
        # Build full context for LLM
        skills_list = self._extract_skills_list(state)
        pref_vec_dict = state.preference_vector.model_dump() if state.preference_vector else {}
        conv_history = ConversationHistoryFormatter.format_to_string(context)

        # Get current recommendation being discussed
        current_rec_summary = "Unknown recommendation"
        if state.current_focus_id:
            rec = state.get_recommendation_by_id(state.current_focus_id)
            if rec:
                if hasattr(rec, 'occupation'):
                    current_rec_summary = rec.occupation
                elif hasattr(rec, 'opportunity_title'):
                    current_rec_summary = rec.opportunity_title
                else:
                    current_rec_summary = 'Recommendation'

        context_block = build_context_block(
            skills=skills_list,
            preference_vector=pref_vec_dict,
            recommendations_summary=f"User is concerned about: {current_rec_summary}",
            conversation_history=conv_history,
            country_of_user=state.country_of_user
        )

        # Add classification context
        classification_context = f"""
## CLASSIFIED RESISTANCE

**Resistance Type**: {classification.resistance_type.upper()}
**User's Concern**: {classification.concern_summary}
**Reasoning**: {classification.reasoning}

---
"""

        # Build full prompt
        full_prompt = context_block + classification_context + ADDRESS_CONCERNS_PROMPT_RESPONSE + "\n\n" + get_json_response_instructions()

        return await self._conversation_caller.call_llm(
            llm=self._conversation_llm,
            llm_input=ConversationHistoryFormatter.format_for_agent_generative_prompt(
                model_response_instructions=full_prompt,
                context=context,
                user_input=user_input
            ),
            logger=self.logger
        )

    async def _handle_blanket_rejection(
        self,
        state: RecommenderAdvisorAgentState,
    ) -> tuple[ConversationResponse, list[LLMStats]]:
        """
        Handle blanket rejection of all recommendations.

        Re-calls the matching engine, filters out already-seen occupations,
        and either presents fresh results or stays open with a graceful message.
        The conversation never terminates here — finished is always False.
        """
        rejected_uuids: set[str] = set(state._filter_rejected_by_type("occupation"))
        rejected_uuids |= set(state.presented_occupations)

        new_occs = []
        if self._recommendation_interface:
            try:
                fresh = await self._recommendation_interface.generate_recommendations(
                    youth_id=state.youth_id,
                    city=state.city,
                    province=state.province,
                    preference_vector=state.preference_vector,
                    skills_vector=state.skills_vector,
                    bws_scores=state.bws_scores,
                    top_10_bws=state.top_10_bws,
                    education_experiences=state.education_experiences,
                )
                new_occs = [
                    occ for occ in fresh.occupation_recommendations
                    if occ.uuid not in rejected_uuids
                ]
                if new_occs:
                    state.recommendations.occupation_recommendations = new_occs
            except Exception:
                self.logger.exception("Failed to refresh recommendations on blanket rejection")

        if new_occs:
            state.conversation_phase = ConversationPhase.PRESENT_RECOMMENDATIONS
            names = ", ".join(o.occupation for o in new_occs[:3])
            message = (
                f"I've searched again and found some new options that might suit you better: "
                f"{names}. Let me walk you through them."
            )
        else:
            message = (
                "I've searched again but don't have any new matches for you right now. "
                "The job database refreshes daily — come back tomorrow and I'll have a fresh set for you."
            )

        return ConversationResponse(
            reasoning="Blanket rejection: re-called matching engine and filtered seen occupations.",
            message=message,
            finished=False,
        ), []

    def _extract_skills_list(self, state: RecommenderAdvisorAgentState) -> list[str]:
        """Extract list of skills from state.skills_vector."""
        if not state.skills_vector:
            return []

        # Handle different possible structures
        if isinstance(state.skills_vector, dict):
            # Could be {"skill_name": proficiency_level} or {"skills": [...]}
            if "skills" in state.skills_vector:
                return state.skills_vector["skills"]
            elif "top_skills" in state.skills_vector:
                # Handle ExperienceEntity-like structure
                skills = state.skills_vector.get("top_skills", [])
                if isinstance(skills, list) and skills:
                    # Extract skill names
                    return [s.get("preferredLabel", s.get("name", str(s))) if isinstance(s, dict) else str(s) for s in skills]
            else:
                # Assume keys are skill names
                return list(state.skills_vector.keys())
        elif isinstance(state.skills_vector, list):
            return state.skills_vector

        return []

