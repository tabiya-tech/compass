"""
Information-theoretic stopping criterion for adaptive preference elicitation.

Decides when to stop showing vignettes based on uncertainty reduction.
"""

import numpy as np
from typing import Dict, Tuple
from ..bayesian.posterior_manager import PosteriorDistribution


class StoppingCriterion:
    """Information-theoretic stopping decision."""

    def __init__(
        self,
        min_vignettes: int = 4,
        max_vignettes: int = 12,
        det_threshold: float = 1e4,  # Increased from 1e2 to allow more adaptive vignettes with information-rich offline D-optimal vignettes
        max_variance_threshold: float = 0.65  # Relaxed from 0.5: work_environment dimension converges slowly due to attribute aggregation
    ):
        """
        Initialize stopping criterion.

        Args:
            min_vignettes: Minimum number to show (safety)
            max_vignettes: Maximum number to show
            det_threshold: Stop if det(FIM) > this (1e4 allows ~8-10 adaptive vignettes)
            max_variance_threshold: Stop if max variance < this (relaxed to 0.65 to reduce average vignette count from 14+ to ~8-10)
        """
        self.min_vignettes = min_vignettes
        self.max_vignettes = max_vignettes
        self.det_threshold = det_threshold
        self.max_variance_threshold = max_variance_threshold

    def should_continue(
        self,
        posterior: PosteriorDistribution,
        fim: np.ndarray,
        n_vignettes_shown: int
    ) -> Tuple[bool, str]:
        """
        Decide whether to continue showing vignettes.

        Returns:
            (should_continue, reason)
        """
        # Safety: always show minimum
        if n_vignettes_shown < self.min_vignettes:
            return True, f"Not yet reached minimum ({self.min_vignettes})"

        # Safety: never exceed maximum
        if n_vignettes_shown >= self.max_vignettes:
            return False, f"Reached maximum ({self.max_vignettes})"

        # Check FIM determinant
        det = np.linalg.det(fim + np.eye(fim.shape[0]) * 1e-8)
        if det >= self.det_threshold:
            return False, f"FIM determinant {det:.2e} exceeds threshold {self.det_threshold:.2e}"

        # Check maximum variance across dimensions
        variances = [posterior.get_variance(dim) for dim in posterior.dimensions]
        max_variance = max(variances)

        if max_variance < self.max_variance_threshold:
            return False, f"Max variance {max_variance:.3f} below threshold {self.max_variance_threshold}"

        # Continue
        return True, "Uncertainty still high, continue eliciting"

    def get_uncertainty_report(
        self,
        posterior: PosteriorDistribution
    ) -> Dict[str, float]:
        """
        Generate report of uncertainty per dimension.

        Returns:
            Dict mapping dimension → variance
        """
        report = {}
        for dim in posterior.dimensions:
            report[dim] = posterior.get_variance(dim)
        return report

    def get_stopping_diagnostics(
        self,
        posterior: PosteriorDistribution,
        fim: np.ndarray,
        n_vignettes_shown: int
    ) -> Dict[str, any]:
        """
        Get detailed diagnostics for stopping decision.

        Returns:
            Dict with diagnostic information
        """
        det = np.linalg.det(fim + np.eye(fim.shape[0]) * 1e-8)
        variances = [posterior.get_variance(dim) for dim in posterior.dimensions]

        return {
            "n_vignettes_shown": n_vignettes_shown,
            "fim_determinant": float(det),
            "max_variance": float(max(variances)),
            "min_variance": float(min(variances)),
            "mean_variance": float(np.mean(variances)),
            "uncertainty_per_dimension": self.get_uncertainty_report(posterior),
            "meets_det_threshold": det >= self.det_threshold,
            "meets_variance_threshold": max(variances) < self.max_variance_threshold,
            "within_vignette_limits": self.min_vignettes <= n_vignettes_shown <= self.max_vignettes
        }
