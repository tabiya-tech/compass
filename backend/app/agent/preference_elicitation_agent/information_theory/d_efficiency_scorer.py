"""
D-efficiency scoring for vignette ranking.

Ranks vignettes by their expected contribution to Fisher Information.
"""

import numpy as np
from typing import List, Tuple
from ..types import Vignette
from .fisher_information import FisherInformationCalculator


class DEfficiencyScorer:
    """Rank vignettes by D-efficiency criterion."""

    def __init__(self, fisher_calculator: FisherInformationCalculator):
        """
        Initialize with Fisher Information calculator.

        Args:
            fisher_calculator: Calculator for FIM
        """
        self.fisher_calculator = fisher_calculator

    def score_vignette(
        self,
        vignette: Vignette,
        posterior_mean: np.ndarray,
        current_fim: np.ndarray
    ) -> float:
        """
        Score a single vignette by its D-efficiency contribution.

        Args:
            vignette: Vignette to score
            posterior_mean: Current posterior mean
            current_fim: Current Fisher Information Matrix

        Returns:
            D-efficiency score (higher = more informative)
        """
        _, det_increase = self.fisher_calculator.compute_expected_fim(
            vignette,
            posterior_mean,
            current_fim
        )
        return det_increase

    def rank_vignettes(
        self,
        vignettes: List[Vignette],
        posterior_mean: np.ndarray,
        current_fim: np.ndarray
    ) -> List[Tuple[Vignette, float]]:
        """
        Rank all vignettes by D-efficiency.

        Args:
            vignettes: List of candidate vignettes
            posterior_mean: Current posterior mean
            current_fim: Current Fisher Information Matrix

        Returns:
            List of (vignette, score) sorted by score (descending)
        """
        ranked = []
        for vignette in vignettes:
            score = self.score_vignette(vignette, posterior_mean, current_fim)
            ranked.append((vignette, score))

        # Sort by score (descending)
        ranked.sort(key=lambda x: x[1], reverse=True)

        return ranked

    def select_top_k(
        self,
        vignettes: List[Vignette],
        posterior_mean: np.ndarray,
        current_fim: np.ndarray,
        k: int = 1
    ) -> List[Vignette]:
        """
        Select top-k vignettes by D-efficiency.

        Args:
            vignettes: List of candidate vignettes
            posterior_mean: Current posterior mean
            current_fim: Current Fisher Information Matrix
            k: Number of vignettes to select

        Returns:
            Top-k vignettes
        """
        ranked = self.rank_vignettes(vignettes, posterior_mean, current_fim)
        return [vignette for vignette, _ in ranked[:k]]
