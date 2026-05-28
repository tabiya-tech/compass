"""
Unit tests for UncertaintyAnalyzer.
"""

import pytest
import numpy as np
from app.agent.preference_elicitation_agent.adaptive_selection.uncertainty_analyzer import UncertaintyAnalyzer
from app.agent.preference_elicitation_agent.bayesian.posterior_manager import PosteriorDistribution


@pytest.fixture
def analyzer():
    """Create default uncertainty analyzer."""
    return UncertaintyAnalyzer(uncertainty_threshold=0.3)


@pytest.fixture
def posterior():
    """Create test posterior distribution."""
    dimensions = ["wage", "remote", "career_growth", "flexibility",
                  "job_security", "task_variety", "culture_alignment"]

    mean = np.array([0.5, 0.3, 0.4, 0.2, 0.6, 0.1, 0.5])
    # Varying variances for testing
    covariance = np.diag([0.8, 0.5, 0.2, 0.1, 0.6, 0.05, 0.4])

    return PosteriorDistribution(
        dimensions=dimensions,
        mean=mean,
        covariance=covariance
    )


class TestUncertaintyAnalyzer:
    """Tests for UncertaintyAnalyzer class."""

    def test_init_default(self):
        """Test initialization with default threshold."""
        analyzer = UncertaintyAnalyzer()
        assert analyzer.uncertainty_threshold == 0.3

    def test_init_custom(self):
        """Test initialization with custom threshold."""
        analyzer = UncertaintyAnalyzer(uncertainty_threshold=0.5)
        assert analyzer.uncertainty_threshold == 0.5

    def test_get_uncertain_dimensions(self, analyzer, posterior):
        """Test getting most uncertain dimensions."""
        uncertain_dims = analyzer.get_uncertain_dimensions(posterior, top_k=3)

        # Should return exactly 3 dimensions
        assert len(uncertain_dims) == 3

        # Should be sorted by uncertainty (descending)
        # Based on posterior fixture: wage=0.8, job_security=0.6, remote=0.5
        assert uncertain_dims[0] == "wage"
        assert uncertain_dims[1] == "job_security"
        assert uncertain_dims[2] == "remote"

    def test_get_uncertain_dimensions_top_k(self, analyzer, posterior):
        """Test varying top_k parameter."""
        # Request different numbers
        top_1 = analyzer.get_uncertain_dimensions(posterior, top_k=1)
        top_5 = analyzer.get_uncertain_dimensions(posterior, top_k=5)

        assert len(top_1) == 1
        assert len(top_5) == 5

        # First element should be the same (most uncertain)
        assert top_1[0] == top_5[0]

    def test_get_uncertainty_scores(self, analyzer, posterior):
        """Test getting uncertainty scores for all dimensions."""
        scores = analyzer.get_uncertainty_scores(posterior)

        # Should have score for each dimension
        assert len(scores) == 7
        assert all(dim in scores for dim in posterior.dimensions)

        # All scores should be non-negative
        assert all(score >= 0 for score in scores.values())

        # Scores should match expected variances
        assert np.isclose(scores["wage"], 0.8)
        assert np.isclose(scores["remote"], 0.5)
        assert np.isclose(scores["task_variety"], 0.05)

    def test_identify_high_uncertainty_dimensions(self, analyzer, posterior):
        """Test identifying dimensions above threshold."""
        high_uncertainty = analyzer.identify_high_uncertainty_dimensions(posterior)

        # Should include dimensions with variance > 0.3
        # wage=0.8, job_security=0.6, remote=0.5, culture_alignment=0.4
        assert "wage" in high_uncertainty
        assert "job_security" in high_uncertainty
        assert "remote" in high_uncertainty
        assert "culture_alignment" in high_uncertainty

        # Should NOT include dimensions with variance <= 0.3
        assert "career_growth" not in high_uncertainty  # 0.2
        assert "flexibility" not in high_uncertainty  # 0.1
        assert "task_variety" not in high_uncertainty  # 0.05

    def test_identify_high_uncertainty_with_different_threshold(self, posterior):
        """Test threshold sensitivity."""
        # Strict threshold (high value)
        strict_analyzer = UncertaintyAnalyzer(uncertainty_threshold=0.6)
        strict_high = strict_analyzer.identify_high_uncertainty_dimensions(posterior)

        # Only wage (0.8) and job_security (0.6) should qualify
        assert len(strict_high) <= 2

        # Lenient threshold (low value)
        lenient_analyzer = UncertaintyAnalyzer(uncertainty_threshold=0.1)
        lenient_high = lenient_analyzer.identify_high_uncertainty_dimensions(posterior)

        # More dimensions should qualify
        assert len(lenient_high) >= len(strict_high)

    def test_compute_global_uncertainty(self, analyzer, posterior):
        """Test global uncertainty computation."""
        global_uncertainty = analyzer.compute_global_uncertainty(posterior)

        # Should be average of all variances
        expected_avg = np.mean([0.8, 0.5, 0.2, 0.1, 0.6, 0.05, 0.4])
        assert np.isclose(global_uncertainty, expected_avg)

        # Should be between min and max variance
        scores = analyzer.get_uncertainty_scores(posterior)
        min_var = min(scores.values())
        max_var = max(scores.values())
        assert min_var <= global_uncertainty <= max_var

    def test_get_dimension_correlations(self, analyzer):
        """Test correlation computation."""
        # Create posterior with known correlations
        dimensions = ["dim1", "dim2", "dim3"]
        mean = np.zeros(3)
        # Create covariance with correlations
        covariance = np.array([
            [1.0, 0.5, 0.0],
            [0.5, 1.0, -0.3],
            [0.0, -0.3, 1.0]
        ])

        posterior = PosteriorDistribution(
            dimensions=dimensions,
            mean=mean,
            covariance=covariance
        )

        correlations = analyzer.get_dimension_correlations(posterior)

        # Should have correlations for each pair
        assert ("dim1", "dim2") in correlations
        assert ("dim1", "dim3") in correlations
        assert ("dim2", "dim3") in correlations

        # Should match expected correlations
        assert np.isclose(correlations[("dim1", "dim2")], 0.5)
        assert np.isclose(correlations[("dim1", "dim3")], 0.0)
        assert np.isclose(correlations[("dim2", "dim3")], -0.3)

    def test_get_uncertainty_report(self, analyzer, posterior):
        """Test comprehensive uncertainty report generation."""
        report = analyzer.get_uncertainty_report(posterior)

        # Check all expected fields present
        assert "global_uncertainty" in report
        assert "uncertainty_per_dimension" in report
        assert "top_uncertain_dimensions" in report
        assert "high_uncertainty_dimensions" in report
        assert "uncertainty_threshold" in report
        assert "n_dimensions_above_threshold" in report

        # Validate field types and values
        assert isinstance(report["global_uncertainty"], float)
        assert isinstance(report["uncertainty_per_dimension"], dict)
        assert isinstance(report["top_uncertain_dimensions"], list)
        assert isinstance(report["high_uncertainty_dimensions"], list)
        assert report["uncertainty_threshold"] == 0.3
        assert isinstance(report["n_dimensions_above_threshold"], int)

        # Top uncertain should have 3 dimensions
        assert len(report["top_uncertain_dimensions"]) == 3

        # Count should match length of high uncertainty list
        assert report["n_dimensions_above_threshold"] == len(report["high_uncertainty_dimensions"])

    def test_empty_high_uncertainty_dimensions(self):
        """Test when no dimensions exceed threshold."""
        analyzer = UncertaintyAnalyzer(uncertainty_threshold=10.0)  # Very high threshold

        dimensions = ["dim1", "dim2", "dim3"]
        mean = np.zeros(3)
        covariance = np.eye(3) * 0.1  # Low variance

        posterior = PosteriorDistribution(
            dimensions=dimensions,
            mean=mean,
            covariance=covariance
        )

        high_uncertainty = analyzer.identify_high_uncertainty_dimensions(posterior)

        # Should be empty
        assert len(high_uncertainty) == 0

    def test_all_high_uncertainty_dimensions(self):
        """Test when all dimensions exceed threshold."""
        analyzer = UncertaintyAnalyzer(uncertainty_threshold=0.01)  # Very low threshold

        dimensions = ["dim1", "dim2", "dim3"]
        mean = np.zeros(3)
        covariance = np.eye(3) * 2.0  # High variance

        posterior = PosteriorDistribution(
            dimensions=dimensions,
            mean=mean,
            covariance=covariance
        )

        high_uncertainty = analyzer.identify_high_uncertainty_dimensions(posterior)

        # Should include all dimensions
        assert len(high_uncertainty) == 3
        assert set(high_uncertainty) == set(dimensions)

    def test_uncertain_dimensions_order_preserved(self, analyzer, posterior):
        """Test that top uncertain dimensions are correctly ordered."""
        uncertain_dims = analyzer.get_uncertain_dimensions(posterior, top_k=7)

        # Get variance for each
        scores = analyzer.get_uncertainty_scores(posterior)
        variances = [scores[dim] for dim in uncertain_dims]

        # Should be sorted in descending order
        assert variances == sorted(variances, reverse=True)

    def test_uncertainty_consistency_across_methods(self, analyzer, posterior):
        """Test that different methods return consistent uncertainty values."""
        scores = analyzer.get_uncertainty_scores(posterior)
        report = analyzer.get_uncertainty_report(posterior)

        # Scores from get_uncertainty_scores should match report
        assert scores == report["uncertainty_per_dimension"]

        # Top uncertain dimensions should be subset of scores keys
        assert all(dim in scores for dim in report["top_uncertain_dimensions"])
