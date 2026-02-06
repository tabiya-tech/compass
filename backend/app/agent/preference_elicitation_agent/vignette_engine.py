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

# NEW: Adaptive D-efficiency imports
import numpy as np
from app.agent.preference_elicitation_agent.bayesian.likelihood_calculator import LikelihoodCalculator
from app.agent.preference_elicitation_agent.information_theory.fisher_information import FisherInformationCalculator
from app.agent.preference_elicitation_agent.adaptive_selection.d_optimal_selector import DOptimalSelector
from app.agent.preference_elicitation_agent.bayesian.posterior_manager import PosteriorDistribution


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
        use_personalization: bool = True,
        use_adaptive_selection: bool = False,
        use_offline_with_personalization: bool = False,
        offline_output_dir: Optional[str] = None
    ):
        """
        Initialize the VignetteEngine.

        Args:
            llm: Language model for personalized vignette generation (required if use_personalization=True or use_offline_with_personalization=True)
            vignettes_config_path: Path to vignettes JSON config file (for backward compatibility)
            use_personalization: Whether to use personalized vignette generation from templates
            use_adaptive_selection: Whether to use D-optimal adaptive selection with offline vignettes (no personalization)
            use_offline_with_personalization: Whether to use offline vignettes WITH personalization (hybrid mode)
            offline_output_dir: Directory containing offline-generated vignettes (required if use_adaptive_selection=True or use_offline_with_personalization=True)
        """
        self._logger = logging.getLogger(self.__class__.__name__)
        self._use_personalization = use_personalization
        self._use_adaptive_selection = use_adaptive_selection
        self._use_offline_with_personalization = use_offline_with_personalization

        # Validate mutually exclusive modes
        if sum([use_personalization, use_adaptive_selection, use_offline_with_personalization]) > 1:
            raise ValueError(
                "Only one mode can be active: use_personalization, use_adaptive_selection, "
                "or use_offline_with_personalization"
            )

        # Static vignettes (backward compatibility)
        self._vignettes: list[Vignette] = []
        self._vignettes_by_id: dict[str, Vignette] = {}
        self._vignettes_by_category: dict[str, list[Vignette]] = {}

        # Offline adaptive vignettes
        self._static_beginning_vignettes: list[Vignette] = []
        self._static_end_vignettes: list[Vignette] = []
        self._adaptive_library_vignettes: list[Vignette] = []

        # Personalized vignettes
        self._personalizer: Optional[VignettePersonalizer] = None
        self._vignette_queue: list[Vignette] = []  # Pre-generated vignettes queue

        # NEW: Adaptive D-efficiency components (lazy init)
        self._d_optimal_selector: Optional[DOptimalSelector] = None
        self._fisher_calculator: Optional[FisherInformationCalculator] = None
        self._likelihood_calculator: Optional[LikelihoodCalculator] = None

        if use_offline_with_personalization:
            # Hybrid mode: offline vignettes WITH personalization
            if llm is None:
                raise ValueError("LLM is required when use_offline_with_personalization=True")
            if offline_output_dir is None:
                # Default to backend/offline_output
                backend_root = Path(__file__).parent.parent.parent.parent
                offline_output_dir = str(backend_root / "offline_output")

            # Load offline vignettes
            self._load_offline_vignettes(offline_output_dir)
            # Initialize adaptive components for D-optimal selection
            self._init_adaptive_components()
            # Initialize personalizer for lazy personalization
            self._personalizer = VignettePersonalizer(llm=llm)

            self._logger.info(
                f"Initialized VignetteEngine with HYBRID mode (offline + personalization): "
                f"{len(self._static_beginning_vignettes)} beginning + "
                f"{len(self._adaptive_library_vignettes)} adaptive + "
                f"{len(self._static_end_vignettes)} end vignettes"
            )
        elif use_adaptive_selection:
            # Load offline-generated vignettes for adaptive D-optimal selection (no personalization)
            if offline_output_dir is None:
                # Default to backend/offline_output
                backend_root = Path(__file__).parent.parent.parent.parent
                offline_output_dir = str(backend_root / "offline_output")

            self._load_offline_vignettes(offline_output_dir)
            self._init_adaptive_components()
            self._logger.info(
                f"Initialized VignetteEngine with adaptive D-optimal selection: "
                f"{len(self._static_beginning_vignettes)} beginning + "
                f"{len(self._adaptive_library_vignettes)} adaptive + "
                f"{len(self._static_end_vignettes)} end vignettes"
            )
        elif use_personalization:
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

    def _load_offline_vignettes(self, offline_dir: str) -> None:
        """
        Load offline-generated vignettes for adaptive D-optimal selection.

        Args:
            offline_dir: Directory containing offline vignette JSON files
        """
        offline_path = Path(offline_dir)

        try:
            # Load static beginning vignettes
            beginning_path = offline_path / "static_vignettes_beginning.json"
            with open(beginning_path, 'r', encoding='utf-8') as f:
                beginning_data = json.load(f)
                for vignette_data in beginning_data["vignettes"]:
                    options = [VignetteOption(**opt) for opt in vignette_data["options"]]
                    vignette_data["options"] = options
                    self._static_beginning_vignettes.append(Vignette(**vignette_data))

            # Load static end vignettes
            end_path = offline_path / "static_vignettes_end.json"
            with open(end_path, 'r', encoding='utf-8') as f:
                end_data = json.load(f)
                for vignette_data in end_data["vignettes"]:
                    options = [VignetteOption(**opt) for opt in vignette_data["options"]]
                    vignette_data["options"] = options
                    self._static_end_vignettes.append(Vignette(**vignette_data))

            # Load adaptive library vignettes
            adaptive_path = offline_path / "adaptive_library.json"
            with open(adaptive_path, 'r', encoding='utf-8') as f:
                adaptive_data = json.load(f)
                for vignette_data in adaptive_data["vignettes"]:
                    options = [VignetteOption(**opt) for opt in vignette_data["options"]]
                    vignette_data["options"] = options
                    self._adaptive_library_vignettes.append(Vignette(**vignette_data))

            self._logger.info(
                f"Loaded offline vignettes: {len(self._static_beginning_vignettes)} beginning, "
                f"{len(self._adaptive_library_vignettes)} adaptive, {len(self._static_end_vignettes)} end"
            )

        except FileNotFoundError as e:
            self._logger.error(f"Offline vignettes not found in {offline_dir}: {e}")
            raise
        except json.JSONDecodeError as e:
            self._logger.error(f"Invalid JSON in offline vignettes: {e}")
            raise
        except Exception as e:
            self._logger.error(f"Error loading offline vignettes: {e}")
            raise

    def get_vignette_by_id(self, vignette_id: str) -> Optional[Vignette]:
        """
        Get a specific vignette by ID.

        Args:
            vignette_id: Unique identifier for the vignette

        Returns:
            Vignette object or None if not found
        """
        # Check static vignettes first
        vignette = self._vignettes_by_id.get(vignette_id)
        if vignette:
            return vignette

        # Check offline vignettes if using adaptive selection OR hybrid mode
        if self._use_adaptive_selection or self._use_offline_with_personalization:
            for v in self._static_beginning_vignettes:
                if v.vignette_id == vignette_id:
                    return v
            for v in self._adaptive_library_vignettes:
                if v.vignette_id == vignette_id:
                    return v
            for v in self._static_end_vignettes:
                if v.vignette_id == vignette_id:
                    return v

        return None

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
        user_context: Optional[UserContext] = None,
        personalization_log_callback: Optional[callable] = None
    ) -> Optional[Vignette]:
        """
        Select the next vignette to present based on current state.

        Supports adaptive D-optimal selection, personalized, static, and hybrid (offline+personalization) modes.

        Args:
            state: Current agent state
            user_context: User context for personalization (required if use_personalization=True or use_offline_with_personalization=True)
            personalization_log_callback: Optional callback to log personalization results (for hybrid mode)

        Returns:
            Next vignette to present, or None if all appropriate vignettes exhausted
        """
        if self._use_offline_with_personalization:
            return await self._select_offline_with_personalization(state, user_context, personalization_log_callback)
        elif self._use_adaptive_selection:
            return await self._select_adaptive_vignette(state)
        elif self._use_personalization:
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

    async def _select_adaptive_vignette(
        self,
        state: PreferenceElicitationAgentState
    ) -> Optional[Vignette]:
        """
        Select next vignette using adaptive D-optimal selection with offline vignettes.

        Flow: 4 static beginning → 0-8 adaptive (D-optimal) → 2 static end

        Args:
            state: Current agent state with posterior beliefs

        Returns:
            Next vignette to present, or None if session complete
        """
        n_shown = len(state.completed_vignettes)

        # Phase 1: Static beginning vignettes (first 4)
        if n_shown < 4:
            vignette = self._static_beginning_vignettes[n_shown]
            self._logger.info(
                f"📍 Phase 1 (Static Beginning): Showing vignette {n_shown + 1}/4: {vignette.vignette_id}"
            )
            return vignette

        # Check if we should transition to end phase
        # This happens when:
        # - We've shown at least 4 beginning vignettes AND
        # - State indicates we should stop adaptive selection
        if hasattr(state, 'adaptive_phase_complete') and state.adaptive_phase_complete:
            # Phase 3: Static end vignettes (last 2)
            end_phase_count = n_shown - 4 - state.adaptive_vignettes_shown_count
            if end_phase_count < 2:
                vignette = self._static_end_vignettes[end_phase_count]
                self._logger.info(
                    f"📍 Phase 3 (Static End): Showing end vignette {end_phase_count + 1}/2: {vignette.vignette_id}"
                )
                return vignette
            else:
                self._logger.info("✅ All vignettes shown (4 beginning + adaptive + 2 end)")
                return None

        # Phase 2: Adaptive D-optimal selection (up to 8 vignettes)
        # Initialize adaptive components if not already done
        self._init_adaptive_components()

        # Check if posterior is initialized
        if state.posterior_mean is None or state.posterior_covariance is None:
            self._logger.error("Posterior not initialized - cannot use adaptive selection")
            return None

        # Reconstruct posterior distribution
        posterior = PosteriorDistribution(
            mean=state.posterior_mean,
            covariance=state.posterior_covariance
        )

        # Reconstruct Fisher Information Matrix
        if state.fisher_information_matrix is None:
            current_fim = np.zeros((7, 7))
        else:
            current_fim = np.array(state.fisher_information_matrix)

        # Get vignettes shown so far
        vignettes_shown = [
            self.get_vignette_by_id(vid)
            for vid in state.completed_vignettes
            if self.get_vignette_by_id(vid) is not None
        ]

        # Get available adaptive vignettes (not yet shown)
        available_vignettes = [
            v for v in self._adaptive_library_vignettes
            if v.vignette_id not in state.completed_vignettes
        ]

        if not available_vignettes:
            self._logger.info("No more adaptive vignettes available - moving to end phase")
            state.adaptive_phase_complete = True
            return await self._select_adaptive_vignette(state)  # Recursive call to get first end vignette

        # Use D-optimal selector to find most informative vignette
        # Enable Bayesian mode to adapt based on posterior uncertainty
        best_vignette = await self._d_optimal_selector.select_next_vignette(
            vignettes=available_vignettes,
            posterior=posterior,
            current_fim=current_fim,
            vignettes_shown=vignettes_shown,
            use_bayesian=True  # Use Bayesian D-optimal (accounts for uncertainty)
        )

        if best_vignette:
            adaptive_count = n_shown - 3  # -3 because we count after showing 4th vignette
            self._logger.info(
                f"📍 Phase 2 (Adaptive D-Optimal): Showing adaptive vignette {adaptive_count}/8: "
                f"{best_vignette.vignette_id} (category: {best_vignette.category})"
            )

        return best_vignette

    async def _select_offline_with_personalization(
        self,
        state: PreferenceElicitationAgentState,
        user_context: Optional[UserContext],
        personalization_log_callback: Optional[callable] = None
    ) -> Optional[Vignette]:
        """
        Hybrid mode: Select vignette using D-optimal + personalize lazily before presentation.

        Flow: 4 static beginning → 0-8 adaptive (D-optimal) → 2 static end
        All vignettes are personalized using user context before being shown.

        Args:
            state: Current agent state with posterior beliefs
            user_context: User context for personalization
            personalization_log_callback: Callback to log personalization results

        Returns:
            Personalized vignette to present, or None if session complete
        """
        # First, select vignette using D-optimal logic (same as adaptive mode)
        # This reuses the exact same logic without personalization
        n_shown = len(state.completed_vignettes)

        # CRITICAL DEBUG - PRINT TO STDOUT
        print("\n" + "="*80)
        print("🔍 HYBRID SELECTION DEBUG")
        print(f"  n_shown: {n_shown}")
        print(f"  completed_vignettes: {state.completed_vignettes}")
        print(f"  adaptive_phase_complete: {getattr(state, 'adaptive_phase_complete', False)}")
        print("="*80 + "\n")

        self._logger.info(
            f"🔍 Hybrid Selection Debug:\n"
            f"  - n_shown (len(completed_vignettes)): {n_shown}\n"
            f"  - completed_vignettes: {state.completed_vignettes}\n"
            f"  - adaptive_phase_complete: {getattr(state, 'adaptive_phase_complete', False)}\n"
            f"  - adaptive_vignettes_shown_count: {getattr(state, 'adaptive_vignettes_shown_count', 0)}"
        )

        # Determine which vignette to select based on phase
        selected_vignette = None
        phase_name = ""

        # Phase 1: Static beginning vignettes (first 4)
        if n_shown < 4:
            selected_vignette = self._static_beginning_vignettes[n_shown]
            phase_name = f"Static Beginning {n_shown + 1}/4"

        # Check if we should transition to end phase
        elif hasattr(state, 'adaptive_phase_complete') and state.adaptive_phase_complete:
            # Phase 3: Static end vignettes (last 2)
            end_phase_count = n_shown - 4 - state.adaptive_vignettes_shown_count
            if end_phase_count < 2:
                selected_vignette = self._static_end_vignettes[end_phase_count]
                phase_name = f"Static End {end_phase_count + 1}/2"
            else:
                self._logger.info("✅ All vignettes shown (4 beginning + adaptive + 2 end)")
                return None

        # Phase 2: Adaptive D-optimal selection
        else:
            # Initialize adaptive components if needed
            self._init_adaptive_components()

            # Check if posterior is initialized
            if state.posterior_mean is None or state.posterior_covariance is None:
                self._logger.error("Posterior not initialized - cannot use adaptive selection")
                return None

            # Reconstruct posterior distribution
            posterior = PosteriorDistribution(
                mean=state.posterior_mean,
                covariance=state.posterior_covariance
            )

            # Reconstruct FIM
            if state.fisher_information_matrix is None:
                current_fim = np.zeros((7, 7))
            else:
                current_fim = np.array(state.fisher_information_matrix)

            # Get vignettes shown so far
            vignettes_shown = [
                self.get_vignette_by_id(vid)
                for vid in state.completed_vignettes
                if self.get_vignette_by_id(vid) is not None
            ]

            # Get available adaptive vignettes
            available_vignettes = [
                v for v in self._adaptive_library_vignettes
                if v.vignette_id not in state.completed_vignettes
            ]

            if not available_vignettes:
                self._logger.info("No more adaptive vignettes available - moving to end phase")
                state.adaptive_phase_complete = True
                return await self._select_offline_with_personalization(state, user_context, personalization_log_callback)

            # Use D-optimal selector
            # Enable Bayesian mode to adapt based on posterior uncertainty
            selected_vignette = await self._d_optimal_selector.select_next_vignette(
                vignettes=available_vignettes,
                posterior=posterior,
                current_fim=current_fim,
                vignettes_shown=vignettes_shown,
                use_bayesian=True  # Use Bayesian D-optimal (accounts for uncertainty)
            )

            if selected_vignette:
                adaptive_count = n_shown - 3
                phase_name = f"Adaptive D-Optimal {adaptive_count}/8"

        if selected_vignette is None:
            return None

        # Track adaptive vignette count for end phase calculation
        if phase_name.startswith("Adaptive D-Optimal"):
            state.adaptive_vignettes_shown_count += 1

        self._logger.info(
            f"📍 Hybrid Mode - Phase: {phase_name}, Selected: {selected_vignette.vignette_id}"
        )

        # Now personalize the selected vignette (lazy personalization)
        if user_context is None:
            self._logger.warning("No user context provided, using default")
            user_context = UserContext()

        try:
            personalized_vignette, personalization_log = await self._personalizer.personalize_concrete_vignette(
                vignette=selected_vignette,
                user_context=user_context
            )

            # Log personalization via callback if provided
            if personalization_log_callback is not None:
                personalization_log_callback(personalization_log)

            if personalization_log.personalization_successful:
                self._logger.info(
                    f"✅ Personalized {selected_vignette.vignette_id}: "
                    f"{personalization_log.personalized.get('reasoning', 'N/A')}"
                )
            else:
                self._logger.warning(
                    f"⚠️  Personalization failed for {selected_vignette.vignette_id}, "
                    f"using original: {personalization_log.error_message}"
                )

            return personalized_vignette

        except Exception as e:
            self._logger.error(
                f"❌ Exception during personalization of {selected_vignette.vignette_id}: {e}",
                exc_info=True
            )
            # Fallback to original vignette
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

    # ========== NEW: Adaptive D-Efficiency Methods ==========

    def _init_adaptive_components(self) -> None:
        """Lazy initialization of adaptive D-efficiency components."""
        if self._d_optimal_selector is None:
            self._likelihood_calculator = LikelihoodCalculator()
            self._fisher_calculator = FisherInformationCalculator(self._likelihood_calculator)
            self._d_optimal_selector = DOptimalSelector(self._fisher_calculator)
            self._logger.info("Initialized adaptive D-efficiency components")

    async def select_next_vignette_adaptive(
        self,
        state: PreferenceElicitationAgentState,
        user_context: Optional[UserContext] = None
    ) -> Optional[Vignette]:
        """
        Select next vignette using D-optimal selection (adaptive mode).

        Uses information-theoretic optimization to select the vignette
        that maximizes expected information gain about preferences.

        Args:
            state: Current agent state with posterior beliefs
            user_context: User context for personalization

        Returns:
            Vignette with highest expected information gain
        """
        # Initialize adaptive components if needed
        self._init_adaptive_components()

        # Check if we have posterior beliefs initialized
        if state.posterior_mean is None or state.posterior_covariance is None:
            self._logger.warning("Posterior not initialized, falling back to non-adaptive selection")
            return await self.select_next_vignette(state, user_context)

        # Reconstruct posterior distribution
        posterior = PosteriorDistribution(
            mean=state.posterior_mean,
            covariance=state.posterior_covariance
        )

        # Reconstruct Fisher Information Matrix
        if state.fisher_information_matrix is None:
            current_fim = np.zeros((7, 7))
        else:
            current_fim = np.array(state.fisher_information_matrix)

        # Get vignettes shown so far
        vignettes_shown = [
            self.get_vignette_by_id(vid)
            for vid in state.completed_vignettes
            if self.get_vignette_by_id(vid) is not None
        ]

        # Get available vignettes (not yet shown)
        if self._use_personalization:
            # For personalized mode, we need to generate candidates
            # For now, fall back to personalized selection
            # TODO: Implement template-level D-optimal selection
            self._logger.info("D-optimal selection with personalization not fully implemented yet")
            return await self._select_personalized_vignette(state, user_context)
        else:
            # For static mode, select from available vignettes
            available_vignettes = [
                v for v in self._vignettes
                if v.vignette_id not in state.completed_vignettes
            ]

            if not available_vignettes:
                self._logger.info("No more vignettes available")
                return None

            # Use D-optimal selector
            # Enable Bayesian mode to adapt based on posterior uncertainty
            best_vignette = await self._d_optimal_selector.select_next_vignette(
                vignettes=available_vignettes,
                posterior=posterior,
                current_fim=current_fim,
                vignettes_shown=vignettes_shown,
                use_bayesian=True  # Use Bayesian D-optimal (accounts for uncertainty)
            )

            if best_vignette:
                self._logger.info(
                    f"Selected D-optimal vignette: {best_vignette.vignette_id} "
                    f"(category: {best_vignette.category})"
                )

            return best_vignette
