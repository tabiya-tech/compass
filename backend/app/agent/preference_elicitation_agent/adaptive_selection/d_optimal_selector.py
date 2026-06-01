"""
D-optimal vignette selector for adaptive preference elicitation.

Selects next vignette that maximizes expected information gain.
"""

from typing import List, Tuple, Dict, Optional
import numpy as np
from ..types import Vignette, VignetteTemplate
from ..bayesian.posterior_manager import PosteriorDistribution
from ..information_theory.fisher_information import FisherInformationCalculator


class DOptimalSelector:
    """Select vignettes using D-optimality criterion."""

    def __init__(
        self,
        fisher_calculator: FisherInformationCalculator,
        min_det_threshold: float = 1e-6
    ):
        """
        Initialize D-optimal selector.

        Args:
            fisher_calculator: Fisher Information calculator
            min_det_threshold: Minimum determinant threshold
        """
        self.fisher_calculator = fisher_calculator
        self.min_det_threshold = min_det_threshold

    async def select_next_vignette(
        self,
        vignettes: List[Vignette],
        posterior: PosteriorDistribution,
        current_fim: np.ndarray,
        vignettes_shown: List[Vignette],
        use_bayesian: bool = True
    ) -> Optional[Vignette]:
        """
        Select vignette that maximizes expected D-efficiency gain.

        Args:
            vignettes: Available vignettes
            posterior: Current posterior distribution
            current_fim: Fisher Information Matrix so far
            vignettes_shown: Vignettes already presented
            use_bayesian: If True, use Bayesian D-optimal (accounts for uncertainty)

        Returns:
            Vignette with highest expected information gain
        """
        posterior_mean = np.array(posterior.mean)
        posterior_cov = np.array(posterior.covariance) if hasattr(posterior, 'covariance') else None

        best_vignette = None
        best_det_increase = -np.inf

        # Filter out already shown vignettes
        vignette_ids_shown = {v.vignette_id for v in vignettes_shown}
        available_vignettes = [v for v in vignettes if v.vignette_id not in vignette_ids_shown]

        for vignette in available_vignettes:
            # Use Bayesian criterion if covariance available and enabled
            if use_bayesian and posterior_cov is not None:
                _, det_increase = self.fisher_calculator.compute_bayesian_expected_fim(
                    vignette,
                    posterior_mean,
                    posterior_cov,
                    current_fim
                )
            else:
                # Fallback to standard D-optimal
                _, det_increase = self.fisher_calculator.compute_expected_fim(
                    vignette,
                    posterior_mean,
                    current_fim
                )

            if det_increase > best_det_increase:
                best_det_increase = det_increase
                best_vignette = vignette

        return best_vignette

    async def select_next_template(
        self,
        templates: List[VignetteTemplate],
        posterior: PosteriorDistribution,
        current_fim: np.ndarray,
        vignettes_shown: List[Vignette]
    ) -> Optional[VignetteTemplate]:
        """
        Select template that maximizes expected D-efficiency gain.

        Uses heuristic: templates testing high-uncertainty dimensions
        are more valuable.

        Args:
            templates: Available vignette templates
            posterior: Current posterior distribution
            current_fim: Fisher Information Matrix so far
            vignettes_shown: Vignettes already presented

        Returns:
            Template with highest expected information gain
        """
        best_template = None
        best_score = -np.inf

        for template in templates:
            # Estimate expected information gain from this template
            score = self._estimate_template_info_gain(
                template,
                posterior,
                current_fim
            )

            if score > best_score:
                best_score = score
                best_template = template

        return best_template

    def _estimate_template_info_gain(
        self,
        template: VignetteTemplate,
        posterior: PosteriorDistribution,
        current_fim: np.ndarray
    ) -> float:
        """
        Estimate information gain from a template.

        Strategy:
        - Look at template's primary trade-off dimensions
        - Compute uncertainty in those dimensions
        - Estimate FIM contribution based on trade-off sharpness

        Args:
            template: Vignette template
            posterior: Current posterior
            current_fim: Current FIM

        Returns:
            Estimated information gain
        """
        # Get primary dimensions tested by this template
        primary_dims = self._get_template_dimensions(template)

        if not primary_dims:
            # Fallback: assume uniform value
            return 0.0

        # Compute current uncertainty in those dimensions
        uncertainty = 0.0
        for dim in primary_dims:
            if dim in posterior.dimensions:
                uncertainty += posterior.get_variance(dim)

        # Templates testing high-uncertainty dimensions are more valuable
        return uncertainty

    def _get_template_dimensions(self, template: VignetteTemplate) -> List[str]:
        """
        Extract which preference dimensions a template tests.

        Args:
            template: Vignette template

        Returns:
            List of dimension names
        """
        # Check template metadata
        if hasattr(template, 'metadata') and template.metadata:
            if 'trade_off_dimensions' in template.metadata:
                return template.metadata['trade_off_dimensions']

        # Check template category
        if hasattr(template, 'category'):
            category = template.category.lower()
            # Map categories to dimensions
            category_map = {
                'financial': ['financial_importance'],
                'work_environment': ['work_environment_importance'],
                'career_growth': ['career_growth_importance'],
                'work_life_balance': ['work_life_balance_importance'],
                'job_security': ['job_security_importance'],
                'task_preference': ['task_preference_importance'],
                'values_culture': ['values_culture_importance']
            }
            return category_map.get(category, [])

        # Default: assume all dimensions
        return []

    def rank_vignettes(
        self,
        vignettes: List[Vignette],
        posterior: PosteriorDistribution,
        current_fim: np.ndarray
    ) -> List[Tuple[Vignette, float]]:
        """
        Rank all vignettes by expected information gain.

        Args:
            vignettes: List of candidate vignettes
            posterior: Current posterior
            current_fim: Current FIM

        Returns:
            List of (vignette, expected_gain) sorted by gain (descending)
        """
        posterior_mean = np.array(posterior.mean)

        ranked = []
        for vignette in vignettes:
            _, det_increase = self.fisher_calculator.compute_expected_fim(
                vignette,
                posterior_mean,
                current_fim
            )
            ranked.append((vignette, det_increase))

        # Sort by gain (descending)
        ranked.sort(key=lambda x: x[1], reverse=True)

        return ranked
