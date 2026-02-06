"""
Bayesian updater - high-level wrapper for posterior updates.
"""

from typing import Dict, Callable
import numpy as np
from .posterior_manager import PosteriorManager, PosteriorDistribution


class BayesianUpdater:
    """
    High-level wrapper for Bayesian posterior updates.

    Manages the update cycle: prior → observation → posterior.
    """

    def __init__(self, prior_mean: np.ndarray, prior_cov: np.ndarray):
        """
        Initialize with prior distribution.

        Args:
            prior_mean: Prior mean vector
            prior_cov: Prior covariance matrix
        """
        self.posterior_manager = PosteriorManager(prior_mean, prior_cov)

    def update(
        self,
        likelihood_fn: Callable,
        observation: Dict
    ) -> PosteriorDistribution:
        """
        Update posterior with new observation.

        Args:
            likelihood_fn: Likelihood function P(observation|β)
            observation: Observed data (vignette + choice)

        Returns:
            Updated posterior distribution
        """
        return self.posterior_manager.update(likelihood_fn, observation)

    def get_posterior(self) -> PosteriorDistribution:
        """Get current posterior distribution."""
        return self.posterior_manager.posterior
