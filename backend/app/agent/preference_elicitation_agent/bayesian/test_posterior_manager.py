"""
Unit tests for PosteriorManager and PosteriorDistribution.
"""

import pytest
import numpy as np
from app.agent.preference_elicitation_agent.bayesian.posterior_manager import (
    PosteriorDistribution,
    PosteriorManager
)


@pytest.fixture
def prior_mean():
    """Prior mean vector."""
    return np.array([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5])


@pytest.fixture
def prior_cov():
    """Prior covariance matrix (diagonal)."""
    return np.eye(7) * 0.5


@pytest.fixture
def posterior_dist():
    """Create sample posterior distribution."""
    return PosteriorDistribution(
        mean=[0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        covariance=[[0.5 if i == j else 0.0 for j in range(7)] for i in range(7)]
    )


@pytest.fixture
def manager(prior_mean, prior_cov):
    """Create posterior manager."""
    return PosteriorManager(prior_mean=prior_mean, prior_cov=prior_cov)


class TestPosteriorDistribution:
    """Tests for PosteriorDistribution class."""

    def test_init(self):
        """Test initialization."""
        posterior = PosteriorDistribution(
            mean=[0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
            covariance=[[1.0 if i == j else 0.0 for j in range(7)] for i in range(7)]
        )

        assert len(posterior.mean) == 7
        assert len(posterior.covariance) == 7
        assert len(posterior.covariance[0]) == 7
        assert len(posterior.dimensions) == 7

    def test_get_variance(self, posterior_dist):
        """Test getting variance for a dimension."""
        variance = posterior_dist.get_variance("financial_importance")

        assert variance == 0.5

    def test_get_variance_all_dimensions(self, posterior_dist):
        """Test getting variance for all dimensions."""
        for dim in posterior_dist.dimensions:
            variance = posterior_dist.get_variance(dim)
            assert variance >= 0

    def test_get_correlation_diagonal(self, posterior_dist):
        """Test correlation with itself is 1."""
        corr = posterior_dist.get_correlation(
            "financial_importance",
            "financial_importance"
        )

        assert np.isclose(corr, 1.0)

    def test_get_correlation_off_diagonal(self, posterior_dist):
        """Test correlation between different dimensions."""
        corr = posterior_dist.get_correlation(
            "financial_importance",
            "work_environment_importance"
        )

        # Diagonal covariance = zero correlation
        assert np.isclose(corr, 0.0)

    def test_get_correlation_with_zero_variance(self):
        """Test correlation when one dimension has zero variance."""
        posterior = PosteriorDistribution(
            mean=[0.5] * 7,
            covariance=[[0.0 if i == 0 or j == 0 else (1.0 if i == j else 0.0) for j in range(7)] for i in range(7)]
        )

        corr = posterior.get_correlation(
            "financial_importance",  # Has zero variance
            "work_environment_importance"
        )

        assert corr == 0.0

    def test_sample_shape(self, posterior_dist):
        """Test sampling returns correct shape."""
        samples = posterior_dist.sample(n_samples=10)

        assert samples.shape == (10, 7)

    def test_sample_statistics(self, posterior_dist):
        """Test sample statistics match distribution."""
        np.random.seed(42)
        samples = posterior_dist.sample(n_samples=10000)

        # Sample mean should be close to posterior mean
        sample_mean = np.mean(samples, axis=0)
        posterior_mean = np.array(posterior_dist.mean)

        assert np.allclose(sample_mean, posterior_mean, atol=0.05)

    def test_dimensions_order(self, posterior_dist):
        """Test dimension names are in expected order."""
        expected = [
            "financial_importance",
            "work_environment_importance",
            "career_growth_importance",
            "work_life_balance_importance",
            "job_security_importance",
            "task_preference_importance",
            "values_culture_importance"
        ]

        assert posterior_dist.dimensions == expected


class TestPosteriorManager:
    """Tests for PosteriorManager class."""

    def test_init(self, manager, prior_mean):
        """Test initialization."""
        assert manager.posterior is not None
        assert len(manager.posterior.mean) == 7
        assert np.allclose(manager.posterior.mean, prior_mean.tolist())

    def test_update_returns_posterior(self, manager):
        """Test update returns PosteriorDistribution."""
        def simple_likelihood(obs, beta):
            return 0.5  # Uninformative likelihood

        observation = {"test": "data"}

        posterior = manager.update(
            likelihood_fn=simple_likelihood,
            observation=observation
        )

        assert isinstance(posterior, PosteriorDistribution)

    def test_update_changes_posterior(self, manager, prior_mean):
        """Test that update changes the posterior."""
        # Informative likelihood
        def informative_likelihood(obs, beta):
            # Prefer higher values in first dimension
            return 1.0 / (1.0 + np.exp(-beta[0]))

        observation = {"choice": "high"}

        original_mean = manager.posterior.mean.copy()

        manager.update(
            likelihood_fn=informative_likelihood,
            observation=observation
        )

        # Posterior should have changed
        assert not np.allclose(manager.posterior.mean, original_mean)

    def test_numerical_gradient_symmetry(self, manager):
        """Test numerical gradient computation."""
        def test_likelihood(obs, beta):
            return np.exp(-np.sum(beta**2))

        beta = np.array([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5])
        observation = {}

        grad = manager._numerical_gradient(test_likelihood, observation, beta)

        # Should be 7-dimensional
        assert grad.shape == (7,)
        assert np.all(np.isfinite(grad))

    def test_numerical_hessian_symmetry(self, manager):
        """Test numerical Hessian is symmetric."""
        def test_likelihood(obs, beta):
            return np.exp(-np.sum(beta**2))

        beta = np.array([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5])
        observation = {}

        hess = manager._numerical_hessian(test_likelihood, observation, beta)

        # Should be symmetric
        assert np.allclose(hess, hess.T)

    def test_find_map_convergence(self, manager, prior_mean, prior_cov):
        """Test MAP finding converges."""
        def quadratic_likelihood(obs, beta):
            # Simple quadratic (has unique maximum)
            return np.exp(-np.sum((beta - 1.0)**2))

        observation = {}

        map_estimate = manager._find_map(
            likelihood_fn=quadratic_likelihood,
            observation=observation,
            prior_mean=prior_mean,
            prior_cov=prior_cov
        )

        # Should converge to somewhere between prior (0.5) and likelihood mode (1.0)
        assert np.all(map_estimate > 0.4)
        assert np.all(map_estimate < 1.1)

    def test_update_with_multiple_observations(self, manager):
        """Test sequential updates."""
        def consistent_likelihood(obs, beta):
            # Prefer beta[0] = 1.0
            return 1.0 / (1.0 + np.exp(-(beta[0] - 1.0)))

        observation = {"data": 1}

        # Multiple updates
        for _ in range(3):
            manager.update(
                likelihood_fn=consistent_likelihood,
                observation=observation
            )

        # First dimension should move toward 1.0
        assert manager.posterior.mean[0] > 0.5

    def test_update_reduces_uncertainty(self, manager):
        """Test that updates generally reduce uncertainty."""
        def informative_likelihood(obs, beta):
            return np.exp(-10 * np.sum((beta - 0.7)**2))

        observation = {}

        initial_variance = manager.posterior.get_variance("financial_importance")

        manager.update(
            likelihood_fn=informative_likelihood,
            observation=observation
        )

        updated_variance = manager.posterior.get_variance("financial_importance")

        # Variance should decrease (information increases)
        assert updated_variance < initial_variance

    def test_singular_hessian_handling(self, manager):
        """Test handling of singular Hessian."""
        def constant_likelihood(obs, beta):
            # Constant likelihood (uninformative)
            return 0.5

        observation = {}

        # Should not crash with singular Hessian
        posterior = manager.update(
            likelihood_fn=constant_likelihood,
            observation=observation
        )

        assert isinstance(posterior, PosteriorDistribution)

    def test_numerical_stability_extreme_values(self, manager):
        """Test numerical stability with extreme beta values."""
        def extreme_likelihood(obs, beta):
            # Likelihood that could produce extreme values
            return 1.0 / (1.0 + np.exp(-np.sum(beta)))

        observation = {}

        # Initialize with extreme values
        manager.posterior.mean = [10.0] * 7

        # Should handle without numerical errors
        posterior = manager.update(
            likelihood_fn=extreme_likelihood,
            observation=observation
        )

        assert all(np.isfinite(posterior.mean))
        assert all(all(np.isfinite(row)) for row in posterior.covariance)

    def test_posterior_covariance_positive_definite(self, manager):
        """Test that posterior covariance remains positive definite."""
        def normal_likelihood(obs, beta):
            return np.exp(-np.sum(beta**2))

        observation = {}

        manager.update(
            likelihood_fn=normal_likelihood,
            observation=observation
        )

        cov_matrix = np.array(manager.posterior.covariance)
        eigenvalues = np.linalg.eigvalsh(cov_matrix)

        # All eigenvalues should be positive (or very small)
        assert np.all(eigenvalues > -1e-6)

    def test_laplace_approximation_symmetry(self, manager):
        """Test Laplace approximation produces symmetric covariance."""
        def simple_likelihood(obs, beta):
            return 0.7

        observation = {}

        manager.update(
            likelihood_fn=simple_likelihood,
            observation=observation
        )

        cov_matrix = np.array(manager.posterior.covariance)

        # Should be symmetric
        assert np.allclose(cov_matrix, cov_matrix.T)

    def test_prior_influence_weakens_with_data(self, prior_mean, prior_cov):
        """Test that prior influence decreases with more data."""
        # Start with informative prior
        manager1 = PosteriorManager(prior_mean=prior_mean, prior_cov=prior_cov * 0.1)
        manager2 = PosteriorManager(prior_mean=prior_mean, prior_cov=prior_cov * 0.1)

        def data_likelihood(obs, beta):
            # Data suggests beta[0] = 0.9
            return np.exp(-100 * (beta[0] - 0.9)**2)

        observation = {}

        # One update
        manager1.update(likelihood_fn=data_likelihood, observation=observation)

        # Multiple updates (more data)
        for _ in range(5):
            manager2.update(likelihood_fn=data_likelihood, observation=observation)

        # With more data, should be closer to data mode (0.9) and farther from prior (0.5)
        assert abs(manager2.posterior.mean[0] - 0.9) < abs(manager1.posterior.mean[0] - 0.9)
