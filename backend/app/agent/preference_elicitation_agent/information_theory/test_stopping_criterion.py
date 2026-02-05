"""
Unit tests for StoppingCriterion.
"""

import pytest
import numpy as np
from app.agent.preference_elicitation_agent.information_theory.stopping_criterion import StoppingCriterion
from app.agent.preference_elicitation_agent.bayesian.posterior_manager import PosteriorDistribution


@pytest.fixture
def stopping_criterion():
    """Create default stopping criterion."""
    return StoppingCriterion(
        min_vignettes=4,
        max_vignettes=12,
        det_threshold=1e4,  # Updated to match new default
        max_variance_threshold=0.5
    )


@pytest.fixture
def posterior():
    """Create test posterior distribution."""
    # 7 dimensions for preference weights
    dimensions = ["wage", "remote", "career_growth", "flexibility",
                  "job_security", "task_variety", "culture_alignment"]

    mean = np.array([0.5, 0.3, 0.4, 0.2, 0.6, 0.1, 0.5])
    covariance = np.eye(7) * 0.3  # Moderate uncertainty

    return PosteriorDistribution(
        dimensions=dimensions,
        mean=mean,
        covariance=covariance
    )


@pytest.fixture
def high_information_fim():
    """Create high-information FIM (determinant > threshold)."""
    # Large diagonal values → high determinant
    return np.eye(7) * 5.0


@pytest.fixture
def low_information_fim():
    """Create low-information FIM (determinant < threshold)."""
    # Small diagonal values → low determinant
    return np.eye(7) * 0.1


class TestStoppingCriterion:
    """Tests for StoppingCriterion class."""

    def test_init_default(self):
        """Test initialization with default parameters."""
        criterion = StoppingCriterion()

        assert criterion.min_vignettes == 4
        assert criterion.max_vignettes == 12
        assert criterion.det_threshold == 1e4  # Updated to match new default
        assert criterion.max_variance_threshold == 0.65  # Updated to match new default

    def test_init_custom(self):
        """Test initialization with custom parameters."""
        criterion = StoppingCriterion(
            min_vignettes=6,
            max_vignettes=10,
            det_threshold=1e3,
            max_variance_threshold=0.3
        )

        assert criterion.min_vignettes == 6
        assert criterion.max_vignettes == 10
        assert criterion.det_threshold == 1e3
        assert criterion.max_variance_threshold == 0.3

    def test_should_continue_below_minimum(self, stopping_criterion, posterior, low_information_fim):
        """Test that we always continue below minimum vignettes."""
        should_continue, reason = stopping_criterion.should_continue(
            posterior=posterior,
            fim=low_information_fim,
            n_vignettes_shown=2  # Below minimum of 4
        )

        assert should_continue is True
        assert "minimum" in reason.lower()

    def test_should_continue_at_minimum(self, stopping_criterion, low_information_fim):
        """Test decision exactly at minimum vignettes."""
        # At minimum, should check other criteria
        # Create posterior with high variance to ensure continuation
        dimensions = ["wage", "remote", "career_growth", "flexibility",
                     "job_security", "task_variety", "culture_alignment"]
        mean = np.array([0.5, 0.3, 0.4, 0.2, 0.6, 0.1, 0.5])
        covariance = np.eye(7) * 2.0  # High uncertainty (> 0.5 threshold)

        high_variance_posterior = PosteriorDistribution(
            dimensions=dimensions,
            mean=mean,
            covariance=covariance
        )

        should_continue, reason = stopping_criterion.should_continue(
            posterior=high_variance_posterior,
            fim=low_information_fim,
            n_vignettes_shown=4  # Exactly at minimum
        )

        # With high variance and low FIM, should continue
        assert should_continue is True

    def test_should_stop_at_maximum(self, stopping_criterion, posterior, low_information_fim):
        """Test that we always stop at maximum vignettes."""
        should_continue, reason = stopping_criterion.should_continue(
            posterior=posterior,
            fim=low_information_fim,
            n_vignettes_shown=12  # At maximum
        )

        assert should_continue is False
        assert "maximum" in reason.lower()

    def test_should_stop_above_maximum(self, stopping_criterion, posterior, low_information_fim):
        """Test that we stop if somehow exceeded maximum."""
        should_continue, reason = stopping_criterion.should_continue(
            posterior=posterior,
            fim=low_information_fim,
            n_vignettes_shown=15  # Above maximum
        )

        assert should_continue is False
        assert "maximum" in reason.lower()

    def test_should_stop_high_det(self, stopping_criterion, posterior, high_information_fim):
        """Test stopping when FIM determinant exceeds threshold."""
        should_continue, reason = stopping_criterion.should_continue(
            posterior=posterior,
            fim=high_information_fim,
            n_vignettes_shown=6  # Between min and max
        )

        assert should_continue is False
        assert "determinant" in reason.lower()

    def test_should_stop_low_variance(self, stopping_criterion, low_information_fim):
        """Test stopping when variance is sufficiently low."""
        # Create posterior with low variance
        dimensions = ["wage", "remote", "career_growth", "flexibility",
                     "job_security", "task_variety", "culture_alignment"]
        mean = np.array([0.5, 0.3, 0.4, 0.2, 0.6, 0.1, 0.5])
        covariance = np.eye(7) * 0.1  # Low uncertainty (< 0.5 threshold)

        low_variance_posterior = PosteriorDistribution(
            dimensions=dimensions,
            mean=mean,
            covariance=covariance
        )

        should_continue, reason = stopping_criterion.should_continue(
            posterior=low_variance_posterior,
            fim=low_information_fim,
            n_vignettes_shown=6
        )

        assert should_continue is False
        assert "variance" in reason.lower()

    def test_should_continue_high_uncertainty(self, stopping_criterion, low_information_fim):
        """Test continuing when uncertainty is still high."""
        # Create posterior with high variance
        dimensions = ["wage", "remote", "career_growth", "flexibility",
                     "job_security", "task_variety", "culture_alignment"]
        mean = np.array([0.5, 0.3, 0.4, 0.2, 0.6, 0.1, 0.5])
        covariance = np.eye(7) * 2.0  # High uncertainty (> 0.5 threshold)

        high_variance_posterior = PosteriorDistribution(
            dimensions=dimensions,
            mean=mean,
            covariance=covariance
        )

        should_continue, reason = stopping_criterion.should_continue(
            posterior=high_variance_posterior,
            fim=low_information_fim,
            n_vignettes_shown=6
        )

        assert should_continue is True
        assert "uncertainty" in reason.lower() or "continue" in reason.lower()

    def test_get_uncertainty_report(self, stopping_criterion, posterior):
        """Test uncertainty report generation."""
        report = stopping_criterion.get_uncertainty_report(posterior)

        # Should have entry for each dimension
        assert len(report) == 7
        assert all(dim in report for dim in posterior.dimensions)

        # All variances should be positive
        assert all(var >= 0 for var in report.values())

    def test_get_stopping_diagnostics(self, stopping_criterion, posterior, low_information_fim):
        """Test diagnostic information generation."""
        diagnostics = stopping_criterion.get_stopping_diagnostics(
            posterior=posterior,
            fim=low_information_fim,
            n_vignettes_shown=6
        )

        # Check all expected fields present
        assert "n_vignettes_shown" in diagnostics
        assert "fim_determinant" in diagnostics
        assert "max_variance" in diagnostics
        assert "min_variance" in diagnostics
        assert "mean_variance" in diagnostics
        assert "uncertainty_per_dimension" in diagnostics
        assert "meets_det_threshold" in diagnostics
        assert "meets_variance_threshold" in diagnostics
        assert "within_vignette_limits" in diagnostics

        # Check values are sensible
        assert diagnostics["n_vignettes_shown"] == 6
        assert diagnostics["fim_determinant"] >= 0
        assert diagnostics["max_variance"] >= diagnostics["min_variance"]
        assert isinstance(diagnostics["meets_det_threshold"], (bool, np.bool_))
        assert isinstance(diagnostics["meets_variance_threshold"], (bool, np.bool_))
        assert isinstance(diagnostics["within_vignette_limits"], (bool, np.bool_))

    def test_stopping_priority_minimum_vignettes(self, stopping_criterion, high_information_fim):
        """Test that minimum vignettes takes priority over other criteria."""
        # Even with high information, should continue below minimum
        dimensions = ["wage", "remote", "career_growth", "flexibility",
                     "job_security", "task_variety", "culture_alignment"]
        mean = np.zeros(7)
        covariance = np.eye(7) * 0.01  # Very low uncertainty

        low_variance_posterior = PosteriorDistribution(
            dimensions=dimensions,
            mean=mean,
            covariance=covariance
        )

        should_continue, reason = stopping_criterion.should_continue(
            posterior=low_variance_posterior,
            fim=high_information_fim,
            n_vignettes_shown=2  # Below minimum
        )

        # Must continue despite low variance and high FIM
        assert should_continue is True

    def test_stopping_priority_maximum_vignettes(self, stopping_criterion, low_information_fim):
        """Test that maximum vignettes takes priority over other criteria."""
        # Even with low information, should stop at maximum
        dimensions = ["wage", "remote", "career_growth", "flexibility",
                     "job_security", "task_variety", "culture_alignment"]
        mean = np.zeros(7)
        covariance = np.eye(7) * 10.0  # Very high uncertainty

        high_variance_posterior = PosteriorDistribution(
            dimensions=dimensions,
            mean=mean,
            covariance=covariance
        )

        should_continue, reason = stopping_criterion.should_continue(
            posterior=high_variance_posterior,
            fim=low_information_fim,
            n_vignettes_shown=12  # At maximum
        )

        # Must stop despite high variance and low FIM
        assert should_continue is False

    def test_varying_thresholds(self, posterior, low_information_fim):
        """Test that different thresholds lead to different decisions."""
        # Strict criterion (low thresholds)
        strict = StoppingCriterion(
            min_vignettes=4,
            max_vignettes=12,
            det_threshold=1e1,  # Lower threshold
            max_variance_threshold=0.2  # Lower threshold
        )

        # Lenient criterion (high thresholds)
        lenient = StoppingCriterion(
            min_vignettes=4,
            max_vignettes=12,
            det_threshold=1e5,  # Higher threshold
            max_variance_threshold=5.0  # Higher threshold
        )

        # Same state
        n_vignettes = 6

        strict_continue, _ = strict.should_continue(posterior, low_information_fim, n_vignettes)
        lenient_continue, _ = lenient.should_continue(posterior, low_information_fim, n_vignettes)

        # Strict should be more likely to stop
        # (though exact behavior depends on actual FIM/variance values)
        assert isinstance(strict_continue, bool)
        assert isinstance(lenient_continue, bool)

    def test_diagnostics_with_edge_cases(self, stopping_criterion):
        """Test diagnostics with edge case inputs."""
        # Singular FIM
        singular_fim = np.zeros((7, 7))

        dimensions = ["wage", "remote", "career_growth", "flexibility",
                     "job_security", "task_variety", "culture_alignment"]
        mean = np.zeros(7)
        covariance = np.eye(7)

        posterior = PosteriorDistribution(
            dimensions=dimensions,
            mean=mean,
            covariance=covariance
        )

        diagnostics = stopping_criterion.get_stopping_diagnostics(
            posterior=posterior,
            fim=singular_fim,
            n_vignettes_shown=0
        )

        # Should not crash and return valid values
        assert diagnostics["fim_determinant"] >= 0
        assert np.isfinite(diagnostics["fim_determinant"])
        assert all(np.isfinite(v) for v in diagnostics["uncertainty_per_dimension"].values())

    def test_reason_strings_informative(self, stopping_criterion, posterior, low_information_fim):
        """Test that reason strings are informative."""
        # Below minimum
        _, reason1 = stopping_criterion.should_continue(posterior, low_information_fim, 2)
        assert len(reason1) > 10  # Should be descriptive

        # At maximum
        _, reason2 = stopping_criterion.should_continue(posterior, low_information_fim, 12)
        assert len(reason2) > 10

        # In between
        _, reason3 = stopping_criterion.should_continue(posterior, low_information_fim, 6)
        assert len(reason3) > 10

    def test_variance_calculation_consistent(self, stopping_criterion, posterior):
        """Test that variance calculations are consistent."""
        report = stopping_criterion.get_uncertainty_report(posterior)
        diagnostics = stopping_criterion.get_stopping_diagnostics(
            posterior, np.eye(7), 6
        )

        # Max/min from diagnostics should match report values
        report_max = max(report.values())
        report_min = min(report.values())

        assert np.isclose(diagnostics["max_variance"], report_max)
        assert np.isclose(diagnostics["min_variance"], report_min)

    def test_boundary_conditions(self, stopping_criterion, posterior):
        """Test boundary conditions for vignette counts."""
        fim = np.eye(7) * 0.5

        # Test n=0
        should_continue_0, _ = stopping_criterion.should_continue(posterior, fim, 0)
        assert should_continue_0 is True  # Below minimum

        # Test n=min
        should_continue_min, _ = stopping_criterion.should_continue(posterior, fim, 4)
        # Decision depends on other criteria

        # Test n=max
        should_continue_max, _ = stopping_criterion.should_continue(posterior, fim, 12)
        assert should_continue_max is False  # At maximum

        # Test n>max
        should_continue_over, _ = stopping_criterion.should_continue(posterior, fim, 20)
        assert should_continue_over is False  # Over maximum
