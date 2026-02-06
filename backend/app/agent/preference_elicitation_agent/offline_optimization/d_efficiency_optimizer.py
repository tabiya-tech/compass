"""
D-Efficiency Optimizer for offline vignette optimization.

Selects optimal static vignettes that maximize information gain.
"""

import logging
import numpy as np
from typing import Dict, List, Any, Tuple
from itertools import combinations
import random


class DEfficiencyOptimizer:
    """Optimizes vignette selection using D-efficiency criterion."""

    def __init__(self, profile_generator):
        """
        Initialize the D-efficiency optimizer.

        Args:
            profile_generator: ProfileGenerator instance for encoding profiles
        """
        self.logger = logging.getLogger(self.__class__.__name__)
        self.profile_generator = profile_generator
        # Always use 7 preference dimensions (not 10 attributes)
        self.n_params = 7

    def select_static_vignettes(
        self,
        profiles: List[Dict[str, Any]],
        num_static: int = 6,
        num_beginning: int = 4,
        prior_mean: np.ndarray = None,
        prior_variance: float = 0.5,
        sample_size: int = 100000
    ) -> Tuple[List[Tuple[Dict, Dict]], List[Tuple[Dict, Dict]]]:
        """
        Select static vignettes using D-efficiency optimization with sampling.

        We want to use a greedy algorithm with random sampling to select vignette pairs
        that maximize the determinant of the Fisher Information Matrix (FIM).

        Args:
            profiles: List of non-dominated job profiles
            num_static: Total number of static vignettes (default: 6)
            num_beginning: Number of vignettes for beginning (default: 4)
            prior_mean: Prior mean for preference weights (7D vector)
            prior_variance: Prior variance (scalar)
            sample_size: Number of vignette pairs to sample per round (default: 100,000)

        Returns:
            Tuple of (beginning_vignettes, end_vignettes)
            Each vignette is a tuple (profile_a, profile_b)
        """
        self.logger.info(
            f"Selecting {num_static} static vignettes from {len(profiles)} profiles..."
        )

        # Initialize prior
        if prior_mean is None:
            # We want to create the prior mean for all the 7 dimensions and initialize all weights to 0.5 which is a neutral/centered value
            prior_mean = np.ones(7) * 0.5 # TODO: Make this configurable

        # Calculate total possible pairs
        total_possible_pairs = len(profiles) * (len(profiles) - 1) // 2
        self.logger.info(f"Total possible vignette pairs: {total_possible_pairs:,}")
        self.logger.info(f"Sampling {sample_size:,} pairs per round for efficiency")

        # Greedy selection
        selected_vignettes = []
        current_fim = np.eye(self.n_params) / prior_variance  # Prior FIM

        for round_idx in range(num_static):
            self.logger.info(f"Selecting vignette {round_idx + 1}/{num_static}...")

            best_vignette = None
            best_det_increase = -np.inf

            # Sample vignette pairs (or use all if total is small)
            if total_possible_pairs <= sample_size:
                # Use all pairs if small enough
                candidate_pairs = list(combinations(profiles, 2))
                self.logger.info(f"  Using all {len(candidate_pairs):,} pairs (exhaustive search)")
            else:
                # Random sampling
                candidate_pairs = []
                sampled = set()

                while len(candidate_pairs) < sample_size:
                    # Random sample
                    i = random.randint(0, len(profiles) - 1)  # nosec B311
                    j = random.randint(0, len(profiles) - 1)  # nosec B311

                    if i == j:
                        continue

                    # Ensure consistent ordering (i < j)
                    if i > j:
                        i, j = j, i

                    # Skip duplicates
                    pair_key = (i, j)
                    if pair_key in sampled:
                        continue

                    sampled.add(pair_key)
                    candidate_pairs.append((profiles[i], profiles[j]))

                self.logger.info(f"  Sampled {len(candidate_pairs):,} random pairs")

            # Evaluate each candidate vignette
            for vignette_pair in candidate_pairs:
                # Skip if already selected
                if vignette_pair in selected_vignettes:
                    continue

                # Skip if one option dominates the other (no trade-off)
                if self._has_pairwise_dominance(vignette_pair[0], vignette_pair[1]):
                    continue

                # Skip if wage difference is too large (psychological anchoring issue)
                if self._has_excessive_wage_gap(vignette_pair[0], vignette_pair[1]):
                    continue

                # Compute FIM contribution
                vignette_fim = self._compute_vignette_fim(
                    vignette_pair[0],
                    vignette_pair[1],
                    prior_mean
                )

                # Compute updated FIM
                updated_fim = current_fim + vignette_fim

                # Compute D-efficiency (determinant)
                det = np.linalg.det(updated_fim)

                # Track best
                det_increase = det - np.linalg.det(current_fim)
                if det_increase > best_det_increase:
                    best_det_increase = det_increase
                    best_vignette = vignette_pair
                    best_fim = vignette_fim

            if best_vignette is None:
                self.logger.warning(
                    f"Could not find vignette for round {round_idx + 1}, stopping early"
                )
                break

            # Add best vignette
            selected_vignettes.append(best_vignette)
            current_fim += best_fim

            self.logger.info(
                f"  Round {round_idx + 1}: Selected vignette with det increase = {best_det_increase:.2e}"
            )
            self.logger.info(
                f"  Current FIM determinant: {np.linalg.det(current_fim):.2e}"
            )

        # Split into beginning and end vignettes
        beginning_vignettes = selected_vignettes[:num_beginning]
        end_vignettes = selected_vignettes[num_beginning:]

        self.logger.info(
            f"Selected {len(beginning_vignettes)} beginning vignettes, "
            f"{len(end_vignettes)} end vignettes"
        )
        self.logger.info(
            f"Final FIM determinant: {np.linalg.det(current_fim):.2e}"
        )

        return beginning_vignettes, end_vignettes

    def _compute_vignette_fim(
        self,
        profile_a: Dict[str, Any],
        profile_b: Dict[str, Any],
        preference_weights: np.ndarray,
        temperature: float = 1.0
    ) -> np.ndarray:
        """
        Compute Fisher Information Matrix for a single vignette.

        Uses the MNL model to compute expected FIM contribution.

        Args:
            profile_a: First job profile
            profile_b: Second job profile
            preference_weights: Current estimate of preference weights (7D)
            temperature: Temperature parameter for choice model (default: 1.0)

        Returns:
            7x7 Fisher Information Matrix
        """
        # Encode profiles to feature vectors
        x_a = np.array(self.profile_generator.encode_profile(profile_a))
        x_b = np.array(self.profile_generator.encode_profile(profile_b))

        # Compute utilities
        u_a = np.dot(x_a, preference_weights) / temperature
        u_b = np.dot(x_b, preference_weights) / temperature

        # Compute choice probabilities (softmax with numerical stability)
        max_u = max(u_a, u_b)
        exp_u_a = np.exp(u_a - max_u)
        exp_u_b = np.exp(u_b - max_u)
        p_a = exp_u_a / (exp_u_a + exp_u_b)
        p_b = 1 - p_a

        # Fisher Information for binary choice
        # FIM = p_A * p_B * (x_A - x_B) * (x_A - x_B)^T
        x_diff = x_a - x_b
        fim = p_a * p_b * np.outer(x_diff, x_diff)

        return fim

    def compute_d_efficiency(
        self,
        vignettes: List[Tuple[Dict, Dict]],
        prior_mean: np.ndarray = None,
        prior_variance: float = 0.5
    ) -> float:
        """
        Compute D-efficiency for a set of vignettes.

        D-efficiency = det(FIM)^(1/k) where k is number of parameters.

        Args:
            vignettes: List of vignette pairs
            prior_mean: Prior mean for preference weights
            prior_variance: Prior variance

        Returns:
            D-efficiency score
        """
        if prior_mean is None:
            prior_mean = np.ones(7) * 0.5

        # Initialize with prior FIM
        fim = np.eye(self.n_params) / prior_variance

        # Add contribution from each vignette
        for profile_a, profile_b in vignettes:
            vignette_fim = self._compute_vignette_fim(profile_a, profile_b, prior_mean)
            fim += vignette_fim

        # Compute D-efficiency
        det = np.linalg.det(fim)
        d_efficiency = det ** (1 / 7)  # 7 parameters

        return d_efficiency

    def get_optimization_statistics(
        self,
        vignettes: List[Tuple[Dict, Dict]],
        prior_mean: np.ndarray = None,
        prior_variance: float = 0.5
    ) -> Dict[str, Any]:
        """
        Get statistics about the optimized vignette set.

        Args:
            vignettes: List of vignette pairs
            prior_mean: Prior mean for preference weights
            prior_variance: Prior variance

        Returns:
            Dictionary with optimization statistics
        """
        if prior_mean is None:
            prior_mean = np.ones(7) * 0.5

        # Compute FIM
        fim = np.eye(self.n_params) / prior_variance
        for profile_a, profile_b in vignettes:
            vignette_fim = self._compute_vignette_fim(profile_a, profile_b, prior_mean)
            fim += vignette_fim

        # Compute statistics
        det = np.linalg.det(fim)
        eigenvalues = np.linalg.eigvals(fim)
        condition_number = np.max(eigenvalues) / np.min(eigenvalues)

        return {
            "num_vignettes": len(vignettes),
            "fim_determinant": float(det),
            "d_efficiency": float(det ** (1 / 7)),
            "eigenvalues": eigenvalues.tolist(),
            "condition_number": float(condition_number),
            "min_eigenvalue": float(np.min(eigenvalues)),
            "max_eigenvalue": float(np.max(eigenvalues))
        }

    def _has_excessive_wage_gap(
        self,
        profile_a: Dict[str, Any],
        profile_b: Dict[str, Any],
        max_ratio: float = 1.67
    ) -> bool:
        """
        Check if wage gap between profiles is too large (psychological anchoring issue).

        Research shows that when salary differences exceed ~60-70%, people tend to
        anchor heavily on the financial dimension and ignore other trade-offs.

        Args:
            profile_a: First profile
            profile_b: Second profile
            max_ratio: Maximum acceptable wage ratio (default: 1.67, i.e., 67% difference)
                      Examples:
                      - 15k vs 25k = 1.67x (acceptable)
                      - 15k vs 30k = 2.0x (too large)
                      - 20k vs 30k = 1.5x (acceptable)
                      - 15k vs 35k = 2.33x (too large)

        Returns:
            True if wage gap is excessive (bad vignette - financial anchoring)
            False if wage gap is reasonable (good vignette)
        """
        wage_a = profile_a.get('wage', 0)
        wage_b = profile_b.get('wage', 0)

        if wage_a == 0 or wage_b == 0:
            return False  # No wage info, can't check

        # Calculate ratio (higher / lower)
        ratio = max(wage_a, wage_b) / min(wage_a, wage_b)

        return ratio > max_ratio

    def _has_pairwise_dominance(
        self,
        profile_a: Dict[str, Any],
        profile_b: Dict[str, Any],
        quasi_dominance_threshold: int = 5
    ) -> bool:
        """
        Check if one profile dominates the other in this vignette pair.

        IMPORTANT: Dominance is checked in the 7-dimensional encoded preference space,
        not the raw 10-attribute space. This ensures we catch vignettes where one option
        is superior in most/all preference dimensions, even if there are minor trade-offs
        at the raw attribute level.

        We check for both:
        1. Strict dominance: One option better/equal in ALL dimensions, strictly better in ≥1
        2. Quasi-dominance: One option better in ≥ quasi_dominance_threshold dimensions
           (default: 5 out of 7, meaning 71%+ of dimensions)

        Args:
            profile_a: First profile in vignette
            profile_b: Second profile in vignette
            quasi_dominance_threshold: Minimum dimensions where one option must be better
                                       to be considered quasi-dominant (default: 5)

        Returns:
            True if either profile dominates or quasi-dominates the other (bad vignette)
            False if neither dominates (good vignette - has meaningful trade-offs)
        """
        # Encode profiles to 7-dimensional preference space
        features_a = np.array(self.profile_generator.encode_profile(profile_a))
        features_b = np.array(self.profile_generator.encode_profile(profile_b))

        # Check strict dominance
        a_dominates_b = self._features_dominate(features_a, features_b)
        b_dominates_a = self._features_dominate(features_b, features_a)

        if a_dominates_b or b_dominates_a:
            return True

        # Check quasi-dominance: count dimensions where each option is better
        tolerance = 1e-6
        a_better_count = sum(1 for i in range(len(features_a))
                           if features_a[i] - features_b[i] > tolerance)
        b_better_count = sum(1 for i in range(len(features_b))
                           if features_b[i] - features_a[i] > tolerance)

        # If either option is better in ≥ threshold dimensions, it's quasi-dominant
        if a_better_count >= quasi_dominance_threshold or b_better_count >= quasi_dominance_threshold:
            return True

        return False

    def _features_dominate(
        self,
        features_a: np.ndarray,
        features_b: np.ndarray,
        tolerance: float = 1e-6
    ) -> bool:
        """
        Check if features_a dominates features_b in the 7-dimensional preference space.

        Features A dominates Features B if:
        - A is better than or equal to B in ALL 7 preference dimensions
        - A is strictly better than B in AT LEAST ONE dimension

        All 7 preference dimensions are "positive" (higher is better):
        - Index 0: financial_importance (higher wage = better)
        - Index 1: work_environment_importance (better conditions = higher)
        - Index 2: career_growth_importance (high growth = higher)
        - Index 3: work_life_balance_importance (better balance = higher)
        - Index 4: job_security_importance (stable = higher)
        - Index 5: task_preference_importance (varied/social = higher)
        - Index 6: values_culture_importance (mission-driven = higher)

        Args:
            features_a: First feature vector (7D)
            features_b: Second feature vector (7D)
            tolerance: Numerical tolerance for "equal" comparison (default: 1e-6)

        Returns:
            True if features_a dominates features_b
        """
        better_or_equal_in_all = True
        strictly_better_in_at_least_one = False

        for i in range(len(features_a)):
            diff = features_a[i] - features_b[i]

            # Check if A is worse than B in this dimension
            if diff < -tolerance:
                better_or_equal_in_all = False
                break

            # Check if A is strictly better than B in this dimension
            if diff > tolerance:
                strictly_better_in_at_least_one = True

        return better_or_equal_in_all and strictly_better_in_at_least_one

    def _profile_dominates(
        self,
        profile_a: Dict[str, Any],
        profile_b: Dict[str, Any],
        attribute_directions: Dict[str, str]
    ) -> bool:
        """
        DEPRECATED: Check if profile_a dominates profile_b in raw attribute space.

        This method is kept for backward compatibility but is NOT used for vignette
        selection. Use _features_dominate() instead, which works in the 7-dimensional
        encoded preference space.

        Profile A dominates Profile B if:
        - A is better than or equal to B in ALL attributes
        - A is strictly better than B in AT LEAST ONE attribute

        Args:
            profile_a: First profile
            profile_b: Second profile
            attribute_directions: Dict mapping attribute → "positive", "negative", or "neutral"

        Returns:
            True if profile_a dominates profile_b
        """
        better_or_equal_in_all = True
        strictly_better_in_at_least_one = False

        for attr_name, direction in attribute_directions.items():
            value_a = profile_a[attr_name]
            value_b = profile_b[attr_name]

            if direction == "positive":
                # Higher is better
                if value_a < value_b:
                    better_or_equal_in_all = False
                    break
                if value_a > value_b:
                    strictly_better_in_at_least_one = True

            elif direction == "negative":
                # Lower is better
                if value_a > value_b:
                    better_or_equal_in_all = False
                    break
                if value_a < value_b:
                    strictly_better_in_at_least_one = True

            # If neutral, any value is acceptable (no dominance check)

        return better_or_equal_in_all and strictly_better_in_at_least_one
