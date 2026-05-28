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
        det_threshold: float = 10.0,
        max_variance_threshold: float = 0.25,
        prior_fim_determinant: float = 0.0
    ):
        """
        Initialize stopping criterion.

        Args:
            min_vignettes: Minimum number to show (safety)
            max_vignettes: Maximum number to show
            det_threshold: Stop if det(FIM)/det(prior_FIM) exceeds this ratio.
                          Measures relative information gain over the prior.
                          Ratio starts at 1.0 (no data) and grows with each vignette.
                          10.0 means "stop when we have 10x more information than the prior alone".
            max_variance_threshold: Stop if max variance < this
            prior_fim_determinant: det(prior_FIM) used to normalize the determinant comparison.
                                  If 0 or not provided, falls back to absolute comparison.
        """
        self.min_vignettes = min_vignettes
        self.max_vignettes = max_vignettes
        self.det_threshold = det_threshold
        self.max_variance_threshold = max_variance_threshold
        self.prior_fim_determinant = prior_fim_determinant

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

        # Check FIM determinant (relative to prior)
        det = np.linalg.det(fim + np.eye(fim.shape[0]) * 1e-8)
        if self.prior_fim_determinant > 0:
            det_ratio = det / self.prior_fim_determinant
            if det_ratio >= self.det_threshold:
                return False, (
                    f"FIM determinant ratio {det_ratio:.2e} exceeds threshold {self.det_threshold:.2e} "
                    f"(det={det:.2e}, prior_det={self.prior_fim_determinant:.2e})"
                )
        else:
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

        det_ratio = det / self.prior_fim_determinant if self.prior_fim_determinant > 0 else det
        meets_det = det_ratio >= self.det_threshold

        return {
            "n_vignettes_shown": n_vignettes_shown,
            "fim_determinant": float(det),
            "fim_determinant_ratio": float(det_ratio),
            "prior_fim_determinant": float(self.prior_fim_determinant),
            "max_variance": float(max(variances)),
            "min_variance": float(min(variances)),
            "mean_variance": float(np.mean(variances)),
            "uncertainty_per_dimension": self.get_uncertainty_report(posterior),
            "meets_det_threshold": meets_det,
            "meets_variance_threshold": max(variances) < self.max_variance_threshold,
            "within_vignette_limits": self.min_vignettes <= n_vignettes_shown <= self.max_vignettes
        }
