"""
Fisher Information Matrix computation for vignette evaluation.

Quantifies how much information a vignette provides about preference parameters.
"""

import numpy as np
from typing import List, Tuple
from ..types import Vignette
from ..bayesian.likelihood_calculator import LikelihoodCalculator


class FisherInformationCalculator:
    """Compute Fisher Information Matrix for vignettes."""

    def __init__(self, likelihood_calculator: LikelihoodCalculator):
        """
        Initialize with likelihood calculator.

        Args:
            likelihood_calculator: Calculator for choice probabilities
        """
        self.likelihood_calculator = likelihood_calculator

    def compute_fim(
        self,
        vignette: Vignette,
        preference_weights: np.ndarray
    ) -> np.ndarray:
        """
        Compute Fisher Information Matrix for a single vignette.

        For binary choice MNL model:
        I(β) = P(A) × P(B) × (x_A - x_B) × (x_A - x_B)ᵀ

        Args:
            vignette: Vignette to evaluate
            preference_weights: Current β estimate

        Returns:
            Fisher Information Matrix (7×7)
        """
        # Extract features - support both old and new format
        if hasattr(vignette, 'option_a') and hasattr(vignette, 'option_b'):
            # Old format (for backward compatibility)
            x_A = self.likelihood_calculator._extract_features(vignette.option_a)
            x_B = self.likelihood_calculator._extract_features(vignette.option_b)
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

            x_A = self.likelihood_calculator._extract_features(option_a)
            x_B = self.likelihood_calculator._extract_features(option_b)

        # Compute choice probabilities under current β
        p_A = self.likelihood_calculator.compute_choice_likelihood(
            vignette, "A", preference_weights
        )
        p_B = 1 - p_A

        # Fisher Information for binary choice
        x_diff = x_A - x_B
        fim = p_A * p_B * np.outer(x_diff, x_diff)

        return fim

    def compute_cumulative_fim(
        self,
        vignettes: List[Vignette],
        preference_weights: np.ndarray
    ) -> np.ndarray:
        """
        Compute cumulative FIM across multiple vignettes.

        Args:
            vignettes: List of vignettes shown so far
            preference_weights: Current β estimate

        Returns:
            Cumulative Fisher Information Matrix (7×7)
        """
        cumulative_fim = np.zeros((7, 7))

        for vignette in vignettes:
            fim = self.compute_fim(vignette, preference_weights)
            cumulative_fim += fim

        return cumulative_fim

    def compute_expected_fim(
        self,
        vignette: Vignette,
        posterior_mean: np.ndarray,
        current_fim: np.ndarray
    ) -> Tuple[np.ndarray, float]:
        """
        Compute expected FIM if this vignette is shown next.

        Used for D-optimal selection: which vignette increases det(FIM) most?

        Args:
            vignette: Candidate vignette
            posterior_mean: Current posterior mean
            current_fim: FIM from vignettes shown so far

        Returns:
            (expected_new_fim, expected_det_increase)
        """
        # Compute FIM contribution of this vignette
        vignette_fim = self.compute_fim(vignette, posterior_mean)

        # Expected new FIM = current + contribution
        expected_new_fim = current_fim + vignette_fim

        # Compute determinant increase
        current_det = self.compute_d_efficiency(current_fim)
        expected_det = self.compute_d_efficiency(expected_new_fim)
        det_increase = expected_det - current_det

        return expected_new_fim, det_increase

    def compute_bayesian_expected_fim(
        self,
        vignette: Vignette,
        posterior_mean: np.ndarray,
        posterior_covariance: np.ndarray,
        current_fim: np.ndarray
    ) -> Tuple[np.ndarray, float]:
        """
        Compute Bayesian D-optimal criterion accounting for directional uncertainty.

        Instead of just maximizing det(FIM), we weight the FIM by the posterior covariance.
        This prioritizes vignettes that test dimensions where we're most uncertain.

        Key insight: A vignette is more valuable if it tests dimensions where
        we have high posterior variance.

        Formula:
            Weighted FIM = x_diff^T * Cov * x_diff
            where x_diff = attributes of option A - attributes of option B

        This makes the score depend on:
        1. How much the vignette contrasts attributes (x_diff)
        2. How uncertain we are in those dimensions (Cov)

        Args:
            vignette: Candidate vignette
            posterior_mean: Current posterior mean
            posterior_covariance: Current posterior covariance (uncertainty)
            current_fim: FIM from vignettes shown so far

        Returns:
            (expected_new_fim, bayesian_det_increase)
        """
        # Compute FIM contribution of this vignette
        vignette_fim = self.compute_fim(vignette, posterior_mean)

        # Expected new FIM = current + contribution
        expected_new_fim = current_fim + vignette_fim

        # Compute standard determinant increase
        current_det = self.compute_d_efficiency(current_fim)
        expected_det = self.compute_d_efficiency(expected_new_fim)
        standard_increase = expected_det - current_det

        # Weight by directional uncertainty
        # Extract the feature difference vector (what this vignette tests)
        try:
            # Extract features from vignette
            if hasattr(vignette, 'option_a') and hasattr(vignette, 'option_b'):
                x_A = self.likelihood_calculator._extract_features(vignette.option_a)
                x_B = self.likelihood_calculator._extract_features(vignette.option_b)
            else:
                option_a = next((opt for opt in vignette.options if opt.option_id == "A"), vignette.options[0])
                option_b = next((opt for opt in vignette.options if opt.option_id == "B"), vignette.options[1])
                x_A = self.likelihood_calculator._extract_features(option_a)
                x_B = self.likelihood_calculator._extract_features(option_b)

            x_diff = x_A - x_B

            # Compute uncertainty-weighted score
            # High score if: vignette tests dimensions with high variance
            regularized_cov = posterior_covariance + np.eye(posterior_covariance.shape[0]) * 1e-8

            # Weighted score: how much uncertainty does this vignette address?
            # x_diff^T * Cov * x_diff measures variance in the direction of x_diff
            directional_uncertainty = x_diff.T @ regularized_cov @ x_diff

            # Bayesian score: standard FIM increase weighted by directional uncertainty
            # Higher if vignette tests uncertain dimensions
            bayesian_increase = standard_increase * (1.0 + directional_uncertainty)

        except (np.linalg.LinAlgError, ValueError, AttributeError):
            # Fallback to standard D-optimal on error
            bayesian_increase = standard_increase

        return expected_new_fim, bayesian_increase

    def compute_d_efficiency(self, fim: np.ndarray) -> float:
        """
        Compute D-efficiency (determinant of FIM).

        Higher = more informative vignette set.

        Returns:
            D-efficiency score
        """
        try:
            # Add small regularization to avoid numerical issues
            regularized_fim = fim + np.eye(fim.shape[0]) * 1e-8
            det = np.linalg.det(regularized_fim)
            # Avoid numerical issues
            if det < 0:
                det = 0.0
            return float(det)
        except np.linalg.LinAlgError:
            return 0.0

    def get_information_per_dimension(
        self,
        fim: np.ndarray
    ) -> np.ndarray:
        """
        Get information (precision) for each dimension.

        Returns diagonal of FIM (variance reduction).

        Returns:
            Array of length 7 (one per dimension)
        """
        return np.diag(fim)

    def compute_information_gain(
        self,
        vignette: Vignette,
        posterior_mean: np.ndarray,
        current_uncertainty: float
    ) -> float:
        """
        Compute expected information gain from showing this vignette.

        Information gain = reduction in uncertainty (entropy/determinant).

        Args:
            vignette: Candidate vignette
            posterior_mean: Current belief about preferences
            current_uncertainty: Current det(covariance)

        Returns:
            Expected information gain
        """
        # Compute FIM for this vignette
        vignette_fim = self.compute_fim(vignette, posterior_mean)

        # Information is inverse of uncertainty
        # Higher FIM → lower uncertainty → more information gained
        fim_det = self.compute_d_efficiency(vignette_fim)

        return fim_det
