"""
Adaptive difficulty adjustment for vignettes.

Adjusts trade-off sharpness based on uncertainty in specific dimensions.
"""

from typing import List, Dict
import numpy as np
from ..bayesian.posterior_manager import PosteriorDistribution
from .uncertainty_analyzer import UncertaintyAnalyzer


class AdaptiveDifficulty:
    """Adjust vignette difficulty based on uncertainty."""

    def __init__(self):
        """Initialize adaptive difficulty adjuster."""
        self.uncertainty_analyzer = UncertaintyAnalyzer()

    def set_difficulty(
        self,
        uncertain_dimensions: List[str],
        posterior: PosteriorDistribution
    ) -> Dict[str, str]:
        """
        Determine difficulty level for each dimension.

        Higher uncertainty → sharper trade-offs (easier to distinguish preferences)

        Args:
            uncertain_dimensions: Dimensions with high uncertainty
            posterior: Current posterior distribution

        Returns:
            Dict mapping dimension → difficulty level ("easy", "medium", "hard")
        """
        difficulty_settings = {}

        for dim in posterior.dimensions:
            variance = posterior.get_variance(dim)

            if dim in uncertain_dimensions:
                # High uncertainty → make trade-offs sharper (easier choices)
                if variance > 0.5:
                    difficulty_settings[dim] = "easy"  # Sharp contrast
                elif variance > 0.3:
                    difficulty_settings[dim] = "medium"  # Moderate contrast
                else:
                    difficulty_settings[dim] = "hard"  # Subtle differences
            else:
                # Low uncertainty → can use subtler trade-offs
                difficulty_settings[dim] = "medium"

        return difficulty_settings

    def compute_optimal_trade_off_strength(
        self,
        dimension: str,
        posterior: PosteriorDistribution
    ) -> float:
        """
        Compute optimal trade-off strength for a dimension.

        Higher uncertainty → stronger trade-offs needed.

        Args:
            dimension: Preference dimension
            posterior: Current posterior

        Returns:
            Trade-off strength (0.0 to 1.0)
        """
        variance = posterior.get_variance(dimension)

        # Map variance to trade-off strength
        # High variance (uncertain) → high strength (sharp differences)
        # Low variance (certain) → low strength (subtle differences)

        if variance > 0.5:
            return 1.0  # Maximum contrast
        elif variance > 0.3:
            return 0.7  # Moderate contrast
        elif variance > 0.15:
            return 0.5  # Balanced
        else:
            return 0.3  # Subtle differences

    def get_difficulty_recommendation(
        self,
        posterior: PosteriorDistribution
    ) -> Dict[str, any]:
        """
        Get comprehensive difficulty recommendations.

        Args:
            posterior: Current posterior distribution

        Returns:
            Dict with difficulty settings and recommendations
        """
        uncertain_dims = self.uncertainty_analyzer.get_uncertain_dimensions(posterior)
        difficulty_per_dim = self.set_difficulty(uncertain_dims, posterior)

        trade_off_strengths = {}
        for dim in posterior.dimensions:
            trade_off_strengths[dim] = self.compute_optimal_trade_off_strength(
                dim,
                posterior
            )

        return {
            "uncertain_dimensions": uncertain_dims,
            "difficulty_per_dimension": difficulty_per_dim,
            "trade_off_strengths": trade_off_strengths,
            "recommendation": f"Focus on dimensions: {', '.join(uncertain_dims[:3])}"
        }
