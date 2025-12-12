"""
Vignette Engine for the Preference Elicitation Agent.

This module handles loading, selecting, and managing vignettes
used in the preference elicitation conversation.

Updated to support personalized vignette generation based on user context.
"""

import json
import random
from pathlib import Path
from typing import Optional
import logging

from app.agent.preference_elicitation_agent.types import (
    Vignette,
    VignetteOption,
    UserContext,
    VignetteTemplate,
    PersonalizedVignette
)
from app.agent.preference_elicitation_agent.state import PreferenceElicitationAgentState
from app.agent.preference_elicitation_agent.vignette_personalizer import VignettePersonalizer
from common_libs.llm.models_utils import BasicLLM


class VignetteEngine:
    """
    Engine for managing vignette selection and presentation.

    Supports both static vignettes (backward compatibility) and
    personalized vignette generation based on user context.
    """

    def __init__(
        self,
        llm: Optional[BasicLLM] = None,
        vignettes_config_path: Optional[str] = None,
        use_personalization: bool = True
    ):
        """
        Initialize the VignetteEngine.

        Args:
            llm: Language model for personalized vignette generation (required if use_personalization=True)
            vignettes_config_path: Path to vignettes JSON config file (for backward compatibility)
            use_personalization: Whether to use personalized vignette generation
        """
        self._logger = logging.getLogger(self.__class__.__name__)
        self._use_personalization = use_personalization

        # Static vignettes (backward compatibility)
        self._vignettes: list[Vignette] = []
        self._vignettes_by_id: dict[str, Vignette] = {}
        self._vignettes_by_category: dict[str, list[Vignette]] = {}

        # Personalized vignettes
        self._personalizer: Optional[VignettePersonalizer] = None
        self._vignette_queue: list[Vignette] = []  # Pre-generated vignettes queue
        if use_personalization:
            if llm is None:
                raise ValueError("LLM is required when use_personalization=True")
            self._personalizer = VignettePersonalizer(llm=llm)
            self._logger.info("Initialized VignetteEngine with personalization")
            
            # Validate all required categories have templates
            required_categories = [
                "financial", "work_environment", "job_security",
                "career_advancement", "work_life_balance", "task_preferences"
            ]
            missing_categories = []
            for category in required_categories:
                templates = self._personalizer.get_templates_by_category(category)
                if not templates:
                    missing_categories.append(category)
            
            if missing_categories:
                self._logger.warning(
                    f"⚠️  CONFIGURATION WARNING: Missing templates for categories: {missing_categories}. "
                    f"These categories will be skipped during preference elicitation!"
                )
        else:
            # Load static vignettes from config for backward compatibility
            if vignettes_config_path is None:
                config_dir = Path(__file__).parent.parent.parent / "config"
                vignettes_config_path = str(config_dir / "vignettes.json")
            self._load_vignettes(vignettes_config_path)
            self._logger.info("Initialized VignetteEngine with static vignettes")

    def _load_vignettes(self, config_path: str) -> None:
        """
        Load vignettes from JSON configuration file.

        Args:
            config_path: Path to vignettes configuration file
        """
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                vignettes_data = json.load(f)

            for vignette_data in vignettes_data:
                # Convert options to VignetteOption objects
                options = [VignetteOption(**opt) for opt in vignette_data["options"]]
                vignette_data["options"] = options

                vignette = Vignette(**vignette_data)
                self._vignettes.append(vignette)
                self._vignettes_by_id[vignette.vignette_id] = vignette

                # Index by category
                category = vignette.category
                if category not in self._vignettes_by_category:
                    self._vignettes_by_category[category] = []
                self._vignettes_by_category[category].append(vignette)

            self._logger.info(f"Loaded {len(self._vignettes)} vignettes from {config_path}")

        except FileNotFoundError:
            self._logger.error(f"Vignettes config file not found: {config_path}")
            raise
        except json.JSONDecodeError as e:
            self._logger.error(f"Invalid JSON in vignettes config: {e}")
            raise
        except Exception as e:
            self._logger.error(f"Error loading vignettes: {e}")
            raise

    def get_vignette_by_id(self, vignette_id: str) -> Optional[Vignette]:
        """
        Get a specific vignette by ID.

        Args:
            vignette_id: Unique identifier for the vignette

        Returns:
            Vignette object or None if not found
        """
        return self._vignettes_by_id.get(vignette_id)

    def get_vignettes_by_category(self, category: str) -> list[Vignette]:
        """
        Get all vignettes for a specific category.

        Args:
            category: Category name (e.g., "financial", "work_environment")

        Returns:
            List of vignettes in that category
        """
        return self._vignettes_by_category.get(category, [])

    async def select_next_vignette(
        self,
        state: PreferenceElicitationAgentState,
        user_context: Optional[UserContext] = None
    ) -> Optional[Vignette]:
        """
        Select the next vignette to present based on current state.

        Supports both personalized and static vignette selection.

        Args:
            state: Current agent state
            user_context: User context for personalization (required if use_personalization=True)

        Returns:
            Next vignette to present, or None if all appropriate vignettes exhausted
        """
        if self._use_personalization:
            return await self._select_personalized_vignette(state, user_context)
        else:
            return self._select_static_vignette(state)

    async def _select_personalized_vignette(
        self,
        state: PreferenceElicitationAgentState,
        user_context: Optional[UserContext]
    ) -> Optional[Vignette]:
        """
        Select and generate a personalized vignette.

        Args:
            state: Current agent state
            user_context: User context for personalization

        Returns:
            Personalized vignette or None
        """
        # Check if there's a pre-generated vignette in the queue
        # BUT validate it's still needed (category not already covered)
        while self._vignette_queue:
            vignette = self._vignette_queue.pop(0)
            
            # Check if this vignette's category is already covered
            if vignette.category in state.categories_covered:
                self._logger.warning(
                    f"⚠️  Discarding pre-warmed vignette {vignette.vignette_id} - "
                    f"category '{vignette.category}' already covered. Queue size: {len(self._vignette_queue)}"
                )
                continue  # Try next vignette in queue
            
            # Valid vignette - use it
            self._logger.info(
                f"✅ Using pre-generated vignette from queue: {vignette.vignette_id} "
                f"(category: {vignette.category})"
            )
            return vignette
        
        # Queue is empty or all queued vignettes were for covered categories
        if self._vignette_queue:
            self._logger.info("All queued vignettes were for covered categories, generating fresh vignette")
        # Fall through to generate a new vignette below

        if self._personalizer is None:
            self._logger.error("Personalizer not initialized")
            return None

        if user_context is None:
            self._logger.warning("No user context provided, using default")
            user_context = UserContext()

        # Get next category to explore
        next_category = state.get_next_category_to_explore()

        self._logger.info(
            f"\n🔍 VignetteEngine: Selecting personalized vignette\n"
            f"  - Next category from state: {next_category}\n"
            f"  - Categories to explore: {state.categories_to_explore}\n"
            f"  - Categories covered: {state.categories_covered}"
        )

        if next_category is None:
            # All priority categories covered
            self._logger.info("✅ All categories explored")
            return None

        # Get templates for this category
        templates = self._personalizer.get_templates_by_category(next_category)

        if not templates:
            self._logger.warning(f"No templates found for category: {next_category}")
            state.mark_category_covered(next_category)
            return await self._select_personalized_vignette(state, user_context)

        # Select template: avoid recently used templates
        used_template_ids = [
            resp.vignette_id.rsplit('_', 1)[0]  # Extract template_id from vignette_id
            for resp in state.vignette_responses[-3:]  # Last 3 responses
        ]

        self._logger.info(
            f"  - Available templates for '{next_category}': {len(templates)}\n"
            f"  - Recently used template IDs (to avoid): {used_template_ids}"
        )

        # Find first unused template, or use first if all used
        template = templates[0]
        for t in templates:
            if t.template_id not in used_template_ids:
                template = t
                break
        
        self._logger.info(
            f"  - Selected template: {template.template_id} (category: {next_category})"
        )

        # Get previous vignette scenarios for context (use scenario text, not user responses)
        previous_scenarios = []
        for resp in state.vignette_responses:
            # Try to get the vignette from cache
            prev_vignette = self.get_vignette_by_id(resp.vignette_id)
            if prev_vignette:
                # Include scenario intro and option titles to avoid repetition
                scenario_summary = f"{prev_vignette.scenario_text} Options: {', '.join(opt.title for opt in prev_vignette.options)}"
                previous_scenarios.append(scenario_summary)

        try:
            # Generate personalized vignette
            personalized = await self._personalizer.personalize_vignette(
                template=template,
                user_context=user_context,
                previous_vignettes=previous_scenarios
            )

            self._logger.info(
                f"✅ Generated personalized vignette:\n"
                f"  - Vignette ID: {personalized.vignette.vignette_id}\n"
                f"  - Template ID: {template.template_id}\n"
                f"  - Category: {next_category}\n"
                f"  - Scenario: {personalized.vignette.scenario_text[:100]}..."
            )

            # Cache the generated vignette for later retrieval
            self._vignettes_by_id[personalized.vignette.vignette_id] = personalized.vignette

            return personalized.vignette

        except Exception as e:
            self._logger.error(f"Error generating personalized vignette: {e}")
            # Fall back to marking category as covered and trying next
            state.mark_category_covered(next_category)
            return await self._select_personalized_vignette(state, user_context)

    def _select_static_vignette(
        self,
        state: PreferenceElicitationAgentState
    ) -> Optional[Vignette]:
        """
        Select the next static vignette (backward compatibility).

        Implements adaptive selection logic:
        1. If starting, select from high-priority categories
        2. Prioritize unexplored categories
        3. Within category, select vignettes not yet shown
        4. Use preference vector to guide selection
        5. Avoid redundant vignettes

        Args:
            state: Current agent state

        Returns:
            Next vignette to present, or None if all appropriate vignettes exhausted
        """
        # Get next category to explore
        next_category = state.get_next_category_to_explore()

        if next_category is None:
            # All priority categories covered, pick from any category
            # that still has unused vignettes
            next_category = self._find_category_with_unused_vignettes(state)

        if next_category is None:
            self._logger.info("No more categories to explore")
            return None

        # Get vignettes for this category that haven't been shown
        available_vignettes = [
            v for v in self.get_vignettes_by_category(next_category)
            if v.vignette_id not in state.completed_vignettes
        ]

        if not available_vignettes:
            # Mark category as covered and try next
            state.mark_category_covered(next_category)
            return self._select_static_vignette(state)

        # Select a vignette from available ones
        selected_vignette = self._select_vignette_from_candidates(
            available_vignettes,
            state
        )

        if selected_vignette:
            self._logger.info(
                f"Selected vignette {selected_vignette.vignette_id} "
                f"from category {next_category}"
            )

        return selected_vignette

    def _find_category_with_unused_vignettes(
        self,
        state: PreferenceElicitationAgentState
    ) -> Optional[str]:
        """
        Find a category that still has unused vignettes.

        Args:
            state: Current agent state

        Returns:
            Category name or None if all vignettes used
        """
        for category in self._vignettes_by_category.keys():
            available = [
                v for v in self._vignettes_by_category[category]
                if v.vignette_id not in state.completed_vignettes
            ]
            if available:
                return category
        return None

    def _select_vignette_from_candidates(
        self,
        candidates: list[Vignette],
        state: PreferenceElicitationAgentState
    ) -> Optional[Vignette]:
        """
        Select a vignette from candidate list.

        Currently uses simple selection strategy. Can be enhanced
        with adaptive logic based on preference vector.

        Args:
            candidates: List of candidate vignettes
            state: Current agent state

        Returns:
            Selected vignette or None
        """
        if not candidates:
            return None

        # Strategy 1: Start with easier vignettes
        if len(state.completed_vignettes) < 2:
            # Prefer easy vignettes at start
            easy_vignettes = [v for v in candidates if v.difficulty_level == "easy"]
            if easy_vignettes:
                return easy_vignettes[0]

        # Strategy 2: Use medium difficulty for middle phase
        if len(state.completed_vignettes) < 4:
            medium_vignettes = [v for v in candidates if v.difficulty_level == "medium"]
            if medium_vignettes:
                return medium_vignettes[0]

        # Strategy 3: Use harder vignettes for refinement
        # Return first available candidate
        return candidates[0]

    def get_follow_up_question(self, vignette_id: str) -> Optional[str]:
        """
        Get a follow-up question for a vignette.

        Args:
            vignette_id: ID of the vignette

        Returns:
            Follow-up question or None
        """
        vignette = self.get_vignette_by_id(vignette_id)
        if vignette and vignette.follow_up_questions:
            # Return first follow-up question
            # TODO: Implement smarter follow-up selection
            return vignette.follow_up_questions[0]
        return None

    def should_ask_follow_up(
        self,
        vignette_id: str,
        state: PreferenceElicitationAgentState
    ) -> bool:
        """
        Determine if a follow-up question should be asked.

        Args:
            vignette_id: ID of the vignette just completed
            state: Current agent state

        Returns:
            True if follow-up should be asked
        """
        vignette = self.get_vignette_by_id(vignette_id)
        if not vignette or not vignette.follow_up_questions:
            return False

        # Ask follow-up for first few vignettes to gather more detail
        if len(state.completed_vignettes) <= 3:
            return True

        # For later vignettes, be selective
        # TODO: Implement logic based on response clarity/confidence
        return False

    def get_total_vignettes_count(self) -> int:
        """
        Get total number of available vignettes.

        Returns:
            Total vignette count
        """
        return len(self._vignettes)

    def get_category_counts(self) -> dict[str, int]:
        """
        Get count of vignettes per category.

        Returns:
            Dictionary mapping category to vignette count
        """
        return {
            category: len(vignettes)
            for category, vignettes in self._vignettes_by_category.items()
        }
