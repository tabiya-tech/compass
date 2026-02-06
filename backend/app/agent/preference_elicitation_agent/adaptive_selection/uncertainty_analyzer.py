"""
Uncertainty analyzer for identifying high-uncertainty preference dimensions.

Used to guide adaptive vignette selection toward dimensions we're most uncertain about.
"""

from typing import List, Dict, Tuple
import numpy as np
from ..bayesian.posterior_manager import PosteriorDistribution


class UncertaintyAnalyzer:
    """Analyze uncertainty across preference dimensions."""

    def __init__(self, uncertainty_threshold: float = 0.3):
        """
        Initialize analyzer.

        Args:
            uncertainty_threshold: Variance threshold for "high uncertainty"
        """
        self.uncertainty_threshold = uncertainty_threshold

    def get_uncertain_dimensions(
        self,
        posterior: PosteriorDistribution,
        top_k: int = 3
    ) -> List[str]:
        """
        Get dimensions with highest uncertainty.

        Args:
            posterior: Current posterior distribution
            top_k: Number of dimensions to return

        Returns:
            List of dimension names, sorted by uncertainty (descending)
        """
        # Compute variance for each dimension
        variances = []
        for dim in posterior.dimensions:
            variance = posterior.get_variance(dim)
            variances.append((dim, variance))

        # Sort by variance (descending)
        variances.sort(key=lambda x: x[1], reverse=True)

        # Return top-k
        return [dim for dim, _ in variances[:top_k]]

    def get_uncertainty_scores(
        self,
        posterior: PosteriorDistribution
    ) -> Dict[str, float]:
        """
        Get uncertainty score for each dimension.

        Returns:
            Dict mapping dimension → variance
        """
        scores = {}
        for dim in posterior.dimensions:
            scores[dim] = posterior.get_variance(dim)
        return scores

    def identify_high_uncertainty_dimensions(
        self,
        posterior: PosteriorDistribution
    ) -> List[str]:
        """
        Identify all dimensions exceeding uncertainty threshold.

        Args:
            posterior: Current posterior distribution

        Returns:
            List of high-uncertainty dimensions
        """
        high_uncertainty = []
        for dim in posterior.dimensions:
            variance = posterior.get_variance(dim)
            if variance > self.uncertainty_threshold:
                high_uncertainty.append(dim)

        return high_uncertainty

    def compute_global_uncertainty(
        self,
        posterior: PosteriorDistribution
    ) -> float:
        """
        Compute overall uncertainty across all dimensions.

        Uses average variance as global uncertainty metric.

        Args:
            posterior: Current posterior distribution

        Returns:
            Global uncertainty score
        """
        variances = [posterior.get_variance(dim) for dim in posterior.dimensions]
        return float(np.mean(variances))

    def get_dimension_correlations(
        self,
        posterior: PosteriorDistribution
    ) -> Dict[Tuple[str, str], float]:
        """
        Get correlations between dimensions.

        Useful for understanding preference structure.

        Args:
            posterior: Current posterior distribution

        Returns:
            Dict mapping (dim1, dim2) → correlation
        """
        correlations = {}
        dims = posterior.dimensions

        for i, dim1 in enumerate(dims):
            for dim2 in dims[i+1:]:
                corr = posterior.get_correlation(dim1, dim2)
                correlations[(dim1, dim2)] = corr

        return correlations

    def get_uncertainty_report(
        self,
        posterior: PosteriorDistribution
    ) -> Dict[str, any]:
        """
        Generate comprehensive uncertainty report.

        Args:
            posterior: Current posterior distribution

        Returns:
            Dict with uncertainty analysis
        """
        uncertainty_scores = self.get_uncertainty_scores(posterior)
        uncertain_dims = self.get_uncertain_dimensions(posterior, top_k=3)
        high_uncertainty_dims = self.identify_high_uncertainty_dimensions(posterior)
        global_uncertainty = self.compute_global_uncertainty(posterior)

        return {
            "global_uncertainty": global_uncertainty,
            "uncertainty_per_dimension": uncertainty_scores,
            "top_uncertain_dimensions": uncertain_dims,
            "high_uncertainty_dimensions": high_uncertainty_dims,
            "uncertainty_threshold": self.uncertainty_threshold,
            "n_dimensions_above_threshold": len(high_uncertainty_dims)
        }
