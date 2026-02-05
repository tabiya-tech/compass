"""
Likelihood calculation for preference elicitation using Multinomial Logit (MNL) model.

Computes P(choice|preferences, vignette) using standard choice probability formulation.
"""

from typing import Dict, Callable
import numpy as np
from ..types import Vignette, VignetteOption


class LikelihoodCalculator:
    """Compute likelihood of observed choices under preference model."""

    def __init__(self, temperature: float = 1.0):
        """
        Initialize likelihood calculator.

        Args:
            temperature: Controls choice stochasticity
                - temperature=1.0: standard MNL
                - temperature>1.0: more random
                - temperature<1.0: more deterministic
        """
        self.temperature = temperature

    def compute_choice_likelihood(
        self,
        vignette: Vignette,
        chosen_option: str,  # "A" or "B"
        preference_weights: np.ndarray
    ) -> float:
        """
        Compute P(chose option | preferences, vignette).

        Uses Multinomial Logit (MNL) model:
        P(A|β) = exp(β·x_A) / [exp(β·x_A) + exp(β·x_B)]

        Args:
            vignette: The vignette shown
            chosen_option: Which option user chose ("A" or "B")
            preference_weights: β vector (7 dimensions)

        Returns:
            Likelihood (probability between 0 and 1)
        """
        # Extract feature vectors for options
        # Support both old format (option_a/option_b) and new format (options list)
        if hasattr(vignette, 'option_a') and hasattr(vignette, 'option_b'):
            # Old format (for backward compatibility)
            x_A = self._extract_features(vignette.option_a)
            x_B = self._extract_features(vignette.option_b)
        else:
            # New format (options list)
            if len(vignette.options) != 2:
                raise ValueError(f"Expected 2 options, got {len(vignette.options)}")

            # Find options by ID
            option_a = next((opt for opt in vignette.options if opt.option_id == "A"), None)
            option_b = next((opt for opt in vignette.options if opt.option_id == "B"), None)

            if option_a is None or option_b is None:
                # Fallback: use first two options
                option_a = vignette.options[0]
                option_b = vignette.options[1]

            x_A = self._extract_features(option_a)
            x_B = self._extract_features(option_b)

        # Compute utilities
        u_A = np.dot(x_A, preference_weights) / self.temperature
        u_B = np.dot(x_B, preference_weights) / self.temperature

        # Choice probabilities (softmax)
        # Use log-sum-exp trick for numerical stability
        max_u = max(u_A, u_B)
        exp_u_A = np.exp(u_A - max_u)
        exp_u_B = np.exp(u_B - max_u)

        p_A = exp_u_A / (exp_u_A + exp_u_B)
        p_B = 1 - p_A

        # Return likelihood of observed choice
        if chosen_option == "A":
            return float(p_A)
        else:
            return float(p_B)

    def _extract_features(self, option: VignetteOption) -> np.ndarray:
        """
        Extract feature vector from vignette option.

        Maps attributes to numerical features:
        - Index 0: financial (salary, benefits)
        - Index 1: work_environment (remote/hybrid, commute)
        - Index 2: career_growth (advancement opportunities)
        - Index 3: work_life_balance (hours, flexibility)
        - Index 4: job_security (contract type)
        - Index 5: task_preference (routine/variety)
        - Index 6: values_culture (alignment)

        Returns:
            Feature vector (7 dimensions)
        """
        features = np.zeros(7)

        # Parse option attributes and map to features
        if hasattr(option, 'attributes') and option.attributes:
            attrs = option.attributes

            # Index 0: Financial - normalize wage
            if "wage" in attrs or "salary" in attrs:
                wage = attrs.get("wage", attrs.get("salary", 0))
                features[0] = float(wage) / 10000

            # Index 1: Work environment - aggregate physical_demand, remote_work, commute_time
            work_env_score = 0.0
            work_env_count = 0

            if "physical_demand" in attrs:
                # Low physical demand (0) = better (1.0), high (1) = worse (0.0)
                work_env_score += (1.0 - float(attrs["physical_demand"]))
                work_env_count += 1

            if "remote_work" in attrs or "remote" in attrs:
                remote = attrs.get("remote_work", attrs.get("remote", 0))
                work_env_score += float(remote)
                work_env_count += 1

            if "commute_time" in attrs:
                # Shorter commute = better (15min=1.0, 60min=0.0)
                commute = float(attrs["commute_time"])
                work_env_score += max(0.0, (60 - commute) / 45)
                work_env_count += 1

            if work_env_count > 0:
                features[1] = work_env_score / work_env_count

            # Index 2: Career growth
            if "career_growth" in attrs:
                features[2] = float(attrs["career_growth"])

            # Index 3: Work-life balance - aggregate flexibility and commute_time
            wlb_score = 0.0
            wlb_count = 0

            if "flexibility" in attrs:
                wlb_score += float(attrs["flexibility"])
                wlb_count += 1

            if "commute_time" in attrs:
                commute = float(attrs["commute_time"])
                wlb_score += max(0.0, (60 - commute) / 45)
                wlb_count += 1

            if wlb_count > 0:
                features[3] = wlb_score / wlb_count

            # Index 4: Job security
            if "job_security" in attrs:
                features[4] = float(attrs["job_security"])

            # Index 5: Task preference - aggregate task_variety and social_interaction
            task_score = 0.0
            task_count = 0

            if "task_variety" in attrs:
                task_score += float(attrs["task_variety"])
                task_count += 1

            if "social_interaction" in attrs:
                task_score += float(attrs["social_interaction"])
                task_count += 1

            if task_count > 0:
                features[5] = task_score / task_count

            # Index 6: Values/culture
            if "company_values" in attrs or "culture_alignment" in attrs:
                values = attrs.get("company_values", attrs.get("culture_alignment", 0))
                features[6] = float(values)

        return features

    def create_likelihood_function(
        self,
        vignette: Vignette,
        chosen_option: str
    ) -> Callable[[Dict, np.ndarray], float]:
        """
        Create likelihood function that can be passed to PosteriorManager.

        Returns:
            Function signature: likelihood(observation, beta) -> float
        """
        def likelihood_fn(observation: Dict, beta: np.ndarray) -> float:
            return self.compute_choice_likelihood(
                vignette=observation["vignette"],
                chosen_option=observation["chosen_option"],
                preference_weights=beta
            )

        return likelihood_fn
