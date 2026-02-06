"""
Bayesian posterior management for preference elicitation.

Maintains and updates posterior distribution over preference parameters using
Laplace approximation for computational efficiency.
"""

from typing import Dict, List, Callable
import numpy as np
from pydantic import BaseModel


class PosteriorDistribution(BaseModel):
    """Bayesian posterior over preference weights."""

    mean: List[float]  # μ: E[β]
    covariance: List[List[float]]  # Σ: Cov[β]

    # Dimension names (maps index → preference dimension)
    dimensions: List[str] = [
        "financial_importance",
        "work_environment_importance",
        "career_growth_importance",
        "work_life_balance_importance",
        "job_security_importance",
        "task_preference_importance",
        "values_culture_importance"
    ]

    class Config:
        """Pydantic configuration."""
        arbitrary_types_allowed = True

    def get_variance(self, dimension: str) -> float:
        """Get uncertainty for specific dimension."""
        idx = self.dimensions.index(dimension)
        return self.covariance[idx][idx]

    def get_correlation(self, dim1: str, dim2: str) -> float:
        """Get correlation between two dimensions."""
        idx1 = self.dimensions.index(dim1)
        idx2 = self.dimensions.index(dim2)
        cov = self.covariance[idx1][idx2]
        std1 = np.sqrt(self.covariance[idx1][idx1])
        std2 = np.sqrt(self.covariance[idx2][idx2])
        if std1 == 0 or std2 == 0:
            return 0.0
        return cov / (std1 * std2)

    def sample(self, n_samples: int = 1) -> np.ndarray:
        """Draw samples from posterior (for uncertainty quantification)."""
        return np.random.multivariate_normal(
            mean=self.mean,
            cov=self.covariance,
            size=n_samples
        )


class PosteriorManager:
    """Manages Bayesian posterior distribution."""

    def __init__(self, prior_mean: np.ndarray, prior_cov: np.ndarray):
        """
        Initialize posterior with prior distribution.

        Args:
            prior_mean: Prior mean vector (7 dimensions)
            prior_cov: Prior covariance matrix (7x7)
        """
        self.posterior = PosteriorDistribution(
            mean=prior_mean.tolist(),
            covariance=prior_cov.tolist()
        )

    def update(
        self,
        likelihood_fn: Callable,
        observation: Dict
    ) -> PosteriorDistribution:
        """
        Update posterior using Bayes rule.

        Uses Laplace approximation:
        - Find MAP estimate via Newton-Raphson
        - Approximate covariance via inverse Hessian

        Args:
            likelihood_fn: Function computing P(observation|β)
            observation: User's choice and vignette shown

        Returns:
            Updated posterior distribution
        """
        # Use Laplace approximation (Newton-Raphson MAP + Hessian)
        current_mean = np.array(self.posterior.mean)
        current_cov = np.array(self.posterior.covariance)

        # Find MAP estimate
        map_estimate = self._find_map(
            likelihood_fn,
            observation,
            current_mean,
            current_cov
        )

        # Compute covariance at MAP
        hessian = self._compute_hessian(
            likelihood_fn,
            observation,
            map_estimate,
            current_cov
        )

        try:
            updated_cov = -np.linalg.inv(hessian)
            # Ensure positive definite
            updated_cov = (updated_cov + updated_cov.T) / 2  # Symmetrize
            # Add small regularization if needed
            eigenvalues = np.linalg.eigvalsh(updated_cov)
            if np.min(eigenvalues) < 1e-8:
                updated_cov += np.eye(len(map_estimate)) * 1e-6
        except np.linalg.LinAlgError:
            # Singular Hessian - keep prior covariance
            updated_cov = current_cov

        self.posterior = PosteriorDistribution(
            mean=map_estimate.tolist(),
            covariance=updated_cov.tolist()
        )

        return self.posterior

    def _find_map(
        self,
        likelihood_fn: Callable,
        observation: Dict,
        prior_mean: np.ndarray,
        prior_cov: np.ndarray,
        max_iter: int = 50,
        tol: float = 1e-6
    ) -> np.ndarray:
        """Find Maximum A Posteriori estimate using Newton-Raphson."""
        beta = prior_mean.copy()

        for iteration in range(max_iter):
            # Compute gradient and Hessian of log-posterior
            grad = self._compute_gradient(
                likelihood_fn,
                observation,
                beta,
                prior_mean,
                prior_cov
            )
            hess = self._compute_hessian(
                likelihood_fn,
                observation,
                beta,
                prior_cov
            )

            # Newton step
            try:
                step = np.linalg.solve(hess, grad)
                beta_new = beta - step
            except np.linalg.LinAlgError:
                break

            # Check convergence
            if np.linalg.norm(beta_new - beta) < tol:
                return beta_new

            beta = beta_new

        return beta

    def _compute_gradient(
        self,
        likelihood_fn: Callable,
        observation: Dict,
        beta: np.ndarray,
        prior_mean: np.ndarray,
        prior_cov: np.ndarray
    ) -> np.ndarray:
        """Compute gradient of log-posterior."""
        # Prior term: -Σ⁻¹(β - μ)
        grad_prior = -np.linalg.solve(prior_cov, beta - prior_mean)

        # Likelihood term (using finite differences)
        grad_likelihood = self._numerical_gradient(likelihood_fn, observation, beta)

        return grad_prior + grad_likelihood

    def _compute_hessian(
        self,
        likelihood_fn: Callable,
        observation: Dict,
        beta: np.ndarray,
        prior_cov: np.ndarray
    ) -> np.ndarray:
        """Compute Hessian of log-posterior."""
        # Prior term: -Σ⁻¹
        hess_prior = -np.linalg.inv(prior_cov)

        # Likelihood term (using finite differences)
        hess_likelihood = self._numerical_hessian(likelihood_fn, observation, beta)

        return hess_prior + hess_likelihood

    def _numerical_gradient(
        self,
        likelihood_fn: Callable,
        observation: Dict,
        beta: np.ndarray,
        epsilon: float = 1e-5
    ) -> np.ndarray:
        """Numerical gradient using finite differences."""
        grad = np.zeros_like(beta)

        for i in range(len(beta)):
            beta_plus = beta.copy()
            beta_plus[i] += epsilon

            beta_minus = beta.copy()
            beta_minus[i] -= epsilon

            log_lik_plus = np.log(likelihood_fn(observation, beta_plus) + 1e-10)
            log_lik_minus = np.log(likelihood_fn(observation, beta_minus) + 1e-10)

            grad[i] = (log_lik_plus - log_lik_minus) / (2 * epsilon)

        return grad

    def _numerical_hessian(
        self,
        likelihood_fn: Callable,
        observation: Dict,
        beta: np.ndarray,
        epsilon: float = 1e-5
    ) -> np.ndarray:
        """Numerical Hessian using finite differences."""
        n = len(beta)
        hess = np.zeros((n, n))

        for i in range(n):
            for j in range(i, n):
                # Compute second derivative
                beta_pp = beta.copy()
                beta_pp[i] += epsilon
                beta_pp[j] += epsilon

                beta_pm = beta.copy()
                beta_pm[i] += epsilon
                beta_pm[j] -= epsilon

                beta_mp = beta.copy()
                beta_mp[i] -= epsilon
                beta_mp[j] += epsilon

                beta_mm = beta.copy()
                beta_mm[i] -= epsilon
                beta_mm[j] -= epsilon

                f_pp = np.log(likelihood_fn(observation, beta_pp) + 1e-10)
                f_pm = np.log(likelihood_fn(observation, beta_pm) + 1e-10)
                f_mp = np.log(likelihood_fn(observation, beta_mp) + 1e-10)
                f_mm = np.log(likelihood_fn(observation, beta_mm) + 1e-10)

                hess[i, j] = (f_pp - f_pm - f_mp + f_mm) / (4 * epsilon**2)
                hess[j, i] = hess[i, j]  # Symmetric

        return hess
