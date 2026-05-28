"""
Vignette Manager for Preference Elicitation Agent.

Handles vignette-related operations including:
- Vignette formatting for presentation
- Follow-up question generation
- Pre-warming (background generation)
- Vignette selection and presentation logic
"""

import logging
import asyncio
from typing import Optional
from app.agent.preference_elicitation_agent.types import (
    Vignette,
    VignetteResponse,
    UserContext
)
from app.agent.preference_elicitation_agent.state import PreferenceElicitationAgentState
from app.agent.preference_elicitation_agent.vignette_engine import VignetteEngine


class VignetteManager:
    """
    Manages vignette operations for preference elicitation.

    Responsibilities:
    - Format vignettes for presentation to users
    - Determine when follow-up questions are needed
    - Pre-generate vignettes to reduce latency
    - Manage vignette selection flow
    """

    def __init__(self, vignette_engine: VignetteEngine):
        """
        Initialize vignette manager.

        Args:
            vignette_engine: VignetteEngine instance
        """
        self.logger = logging.getLogger(self.__class__.__name__)
        self._vignette_engine = vignette_engine

    def format_vignette_for_presentation(self, vignette: Vignette) -> str:
        """
        Format a vignette into a natural conversational message.

        Args:
            vignette: Vignette to format

        Returns:
            Formatted message string
        """
        message_parts = [vignette.scenario_text, ""]

        # Format options
        for i, option in enumerate(vignette.options, 1):
            option_label = chr(64 + i)  # A, B, C, etc.
            message_parts.append(f"**Option {option_label}**: {option.title}")
            message_parts.append(f"{option.description}")
            message_parts.append("")

        message_parts.append("Which option feels more like you? (Just say A or B, or tell me what you think)")

        return "\n".join(message_parts)

    def should_ask_follow_up(self, vignette_response: VignetteResponse) -> bool:
        """
        Determine if a follow-up question is needed for this vignette response.

        Follow-up questions help extract deeper preference insights by understanding
        the "why" behind choices.

        Args:
            vignette_response: User's response to a vignette

        Returns:
            True if follow-up question should be asked
        """
        # Ask follow-up for first few vignettes to establish pattern
        if len(vignette_response.reasoning) > 100:
            # User already provided detailed reasoning, skip follow-up
            return False

        # Ask follow-up if user made a clear choice but didn't explain much
        if vignette_response.selected_option_id and len(vignette_response.reasoning) < 50:
            return True

        return False

    async def prewarm_next_vignette(
        self,
        state: PreferenceElicitationAgentState,
        user_context: Optional[UserContext] = None
    ) -> None:
        """
        Pre-generate the next vignette in the background to reduce latency.

        This is called as a background task during earlier phases
        so the vignette is ready when needed.

        Args:
            state: Current agent state
            user_context: User context for personalization
        """
        if not self._vignette_engine._use_personalization:
            return

        try:
            # Only pre-warm if queue is empty
            if self._vignette_engine._vignette_queue:
                self.logger.debug("Vignette queue not empty, skipping pre-warm")
                return

            next_category = state.get_next_category_to_explore()
            if not next_category or next_category in state.categories_covered:
                return

            self.logger.info(f"Pre-warming vignette for category: {next_category}")

            # Get templates for next category
            templates = self._vignette_engine._personalizer.get_templates_by_category(next_category)
            if not templates:
                return

            # Select template: avoid recently used ones
            used_template_ids = [
                resp.vignette_id.rsplit('_', 1)[0]
                for resp in state.vignette_responses[-3:]
            ]

            template = templates[0]
            for t in templates:
                if t.template_id not in used_template_ids:
                    template = t
                    break

            # Build previous scenarios context
            previous_scenarios = []
            for resp in state.vignette_responses:
                prev_vignette = self._vignette_engine.get_vignette_by_id(resp.vignette_id)
                if prev_vignette:
                    scenario_summary = (
                        f"{prev_vignette.scenario_text} "
                        f"Options: {', '.join(opt.title for opt in prev_vignette.options)}"
                    )
                    previous_scenarios.append(scenario_summary)

            # Generate personalized vignette
            personalized = await self._vignette_engine._personalizer.personalize_vignette(
                template=template,
                user_context=user_context,
                previous_vignettes=previous_scenarios
            )

            # Cache and queue
            self._vignette_engine._vignettes_by_id[personalized.vignette.vignette_id] = (
                personalized.vignette
            )
            self._vignette_engine._vignette_queue.append(personalized.vignette)

            self.logger.info(f"Pre-warmed vignette {personalized.vignette.vignette_id}")

        except Exception as e:
            self.logger.warning(f"Failed to pre-warm vignette: {e}")

    async def select_and_format_vignette(
        self,
        state: PreferenceElicitationAgentState
    ) -> Optional[str]:
        """
        Select next vignette and format it for presentation.

        Args:
            state: Current agent state

        Returns:
            Formatted vignette message or None if no vignettes available
        """
        vignette = await self._vignette_engine.select_next_vignette(state)
        if not vignette:
            return None

        return self.format_vignette_for_presentation(vignette)
