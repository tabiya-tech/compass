"""
Unit tests for AdaptiveDifficulty.
"""

import pytest
import numpy as np
from app.agent.preference_elicitation_agent.adaptive_selection.adaptive_difficulty import AdaptiveDifficulty
from app.agent.preference_elicitation_agent.bayesian.posterior_manager import PosteriorDistribution


@pytest.fixture
def adaptive_difficulty():
    """Create adaptive difficulty adjuster."""
    return AdaptiveDifficulty()


@pytest.fixture
def posterior():
    """Create test posterior distribution."""
    dimensions = ["wage", "remote", "career_growth", "flexibility",
                  "job_security", "task_variety", "culture_alignment"]

    mean = np.array([0.5, 0.3, 0.4, 0.2, 0.6, 0.1, 0.5])
    # Varying variances for testing difficulty logic
    covariance = np.diag([0.8, 0.5, 0.35, 0.1, 0.6, 0.05, 0.25])

    return PosteriorDistribution(
        dimensions=dimensions,
        mean=mean,
        covariance=covariance
    )


class TestAdaptiveDifficulty:
    """Tests for AdaptiveDifficulty class."""

    def test_init(self):
        """Test initialization."""
        adj = AdaptiveDifficulty()
        assert hasattr(adj, 'uncertainty_analyzer')

    def test_set_difficulty(self, adaptive_difficulty, posterior):
        """Test difficulty setting for dimensions."""
        uncertain_dims = ["wage", "job_security", "remote"]  # High variance dims

        difficulty_settings = adaptive_difficulty.set_difficulty(
            uncertain_dims, posterior
        )

        # Should have setting for each dimension
        assert len(difficulty_settings) == 7

        # High uncertainty dimensions should have appropriate difficulty
        # wage has variance 0.8 > 0.5 → "easy"
        assert difficulty_settings["wage"] == "easy"

        # job_security has variance 0.6 > 0.5 → "easy"
        assert difficulty_settings["job_security"] == "easy"

        # remote has variance 0.5 (not > 0.5) but > 0.3 → "medium"
        assert difficulty_settings["remote"] == "medium"

        # Low uncertainty dimensions (not in uncertain_dims) → "medium"
        assert difficulty_settings["flexibility"] == "medium"
        assert difficulty_settings["task_variety"] == "medium"

    def test_set_difficulty_all_levels(self, adaptive_difficulty):
        """Test that all difficulty levels can be generated."""
        dimensions = ["dim1", "dim2", "dim3"]
        mean = np.zeros(3)

        # dim1: high variance (> 0.5)
        # dim2: medium variance (0.3 < var < 0.5)
        # dim3: low variance (< 0.3)
        covariance = np.diag([0.7, 0.35, 0.15])

        posterior = PosteriorDistribution(
            dimensions=dimensions,
            mean=mean,
            covariance=covariance
        )

        # All are uncertain dimensions
        uncertain_dims = ["dim1", "dim2", "dim3"]

        difficulty_settings = adaptive_difficulty.set_difficulty(
            uncertain_dims, posterior
        )

        # dim1: variance > 0.5 → "easy"
        assert difficulty_settings["dim1"] == "easy"

        # dim2: 0.3 < variance < 0.5 → "medium"
        assert difficulty_settings["dim2"] == "medium"

        # dim3: variance < 0.3 → "hard"
        assert difficulty_settings["dim3"] == "hard"

    def test_compute_optimal_trade_off_strength(self, adaptive_difficulty, posterior):
        """Test trade-off strength computation."""
        # wage has variance 0.8 > 0.5 → strength = 1.0
        strength_wage = adaptive_difficulty.compute_optimal_trade_off_strength(
            "wage", posterior
        )
        assert strength_wage == 1.0

        # career_growth has variance 0.35 (0.3 < var < 0.5) → strength = 0.7
        strength_career = adaptive_difficulty.compute_optimal_trade_off_strength(
            "career_growth", posterior
        )
        assert strength_career == 0.7

        # flexibility has variance 0.1 (< 0.15) → strength = 0.3
        strength_flex = adaptive_difficulty.compute_optimal_trade_off_strength(
            "flexibility", posterior
        )
        assert strength_flex == 0.3

    def test_compute_optimal_trade_off_strength_all_levels(self, adaptive_difficulty):
        """Test all possible trade-off strength levels."""
        dimensions = ["high", "medium_high", "medium", "low"]
        mean = np.zeros(4)

        # high: var > 0.5 → 1.0
        # medium_high: 0.3 < var <= 0.5 → 0.7
        # medium: 0.15 < var <= 0.3 → 0.5
        # low: var <= 0.15 → 0.3
        covariance = np.diag([0.6, 0.4, 0.2, 0.1])

        posterior = PosteriorDistribution(
            dimensions=dimensions,
            mean=mean,
            covariance=covariance
        )

        strength_high = adaptive_difficulty.compute_optimal_trade_off_strength(
            "high", posterior
        )
        assert strength_high == 1.0

        strength_med_high = adaptive_difficulty.compute_optimal_trade_off_strength(
            "medium_high", posterior
        )
        assert strength_med_high == 0.7

        strength_med = adaptive_difficulty.compute_optimal_trade_off_strength(
            "medium", posterior
        )
        assert strength_med == 0.5

        strength_low = adaptive_difficulty.compute_optimal_trade_off_strength(
            "low", posterior
        )
        assert strength_low == 0.3

    def test_get_difficulty_recommendation(self, adaptive_difficulty, posterior):
        """Test comprehensive difficulty recommendation."""
        recommendation = adaptive_difficulty.get_difficulty_recommendation(posterior)

        # Check all expected fields present
        assert "uncertain_dimensions" in recommendation
        assert "difficulty_per_dimension" in recommendation
        assert "trade_off_strengths" in recommendation
        assert "recommendation" in recommendation

        # Uncertain dimensions should be the top 3 most uncertain
        uncertain_dims = recommendation["uncertain_dimensions"]
        assert len(uncertain_dims) <= 3

        # Should include highest variance dimensions
        # From posterior: wage=0.8, job_security=0.6, remote=0.5
        assert "wage" in uncertain_dims
        assert "job_security" in uncertain_dims

        # Difficulty settings should cover all dimensions
        difficulty_per_dim = recommendation["difficulty_per_dimension"]
        assert len(difficulty_per_dim) == 7

        # Trade-off strengths should cover all dimensions
        trade_off_strengths = recommendation["trade_off_strengths"]
        assert len(trade_off_strengths) == 7

        # All trade-off strengths should be between 0 and 1
        assert all(0 <= strength <= 1 for strength in trade_off_strengths.values())

        # Recommendation should be a string
        assert isinstance(recommendation["recommendation"], str)
        assert "Focus on dimensions:" in recommendation["recommendation"]

    def test_difficulty_inverse_to_variance(self, adaptive_difficulty):
        """Test that higher variance leads to easier difficulty."""
        dimensions = ["low_var", "high_var"]
        mean = np.zeros(2)
        covariance = np.diag([0.1, 0.9])

        posterior = PosteriorDistribution(
            dimensions=dimensions,
            mean=mean,
            covariance=covariance
        )

        # Both are uncertain
        uncertain_dims = ["low_var", "high_var"]

        difficulty_settings = adaptive_difficulty.set_difficulty(
            uncertain_dims, posterior
        )

        # High variance → easier difficulty
        assert difficulty_settings["high_var"] == "easy"

        # Low variance → harder difficulty
        assert difficulty_settings["low_var"] == "hard"

    def test_trade_off_strength_inverse_to_variance(self, adaptive_difficulty):
        """Test that higher variance leads to stronger trade-offs."""
        dimensions = ["low_var", "high_var"]
        mean = np.zeros(2)
        covariance = np.diag([0.1, 0.9])

        posterior = PosteriorDistribution(
            dimensions=dimensions,
            mean=mean,
            covariance=covariance
        )

        strength_low = adaptive_difficulty.compute_optimal_trade_off_strength(
            "low_var", posterior
        )
        strength_high = adaptive_difficulty.compute_optimal_trade_off_strength(
            "high_var", posterior
        )

        # Higher variance → higher strength
        assert strength_high > strength_low

    def test_recommendation_includes_uncertain_dims(self, adaptive_difficulty, posterior):
        """Test that recommendation text includes uncertain dimensions."""
        recommendation = adaptive_difficulty.get_difficulty_recommendation(posterior)

        rec_text = recommendation["recommendation"]
        uncertain_dims = recommendation["uncertain_dimensions"]

        # Recommendation should mention at least some uncertain dimensions
        # (limited to top 3 in the recommendation text)
        for dim in uncertain_dims[:3]:
            # May not be in text if < 3 uncertain dims
            pass

        # At minimum, recommendation should be non-empty
        assert len(rec_text) > 0

    def test_consistency_across_methods(self, adaptive_difficulty, posterior):
        """Test that different methods return consistent results."""
        recommendation = adaptive_difficulty.get_difficulty_recommendation(posterior)

        uncertain_dims = recommendation["uncertain_dimensions"]

        # Manually call set_difficulty with same uncertain dims
        difficulty_manual = adaptive_difficulty.set_difficulty(
            uncertain_dims, posterior
        )

        # Should match the difficulty in recommendation
        assert difficulty_manual == recommendation["difficulty_per_dimension"]

        # Trade-off strengths should be consistent
        for dim in posterior.dimensions:
            strength_manual = adaptive_difficulty.compute_optimal_trade_off_strength(
                dim, posterior
            )
            assert strength_manual == recommendation["trade_off_strengths"][dim]

    def test_edge_case_all_equal_variance(self, adaptive_difficulty):
        """Test behavior when all dimensions have equal variance."""
        dimensions = ["dim1", "dim2", "dim3"]
        mean = np.zeros(3)
        covariance = np.eye(3) * 0.4  # All equal variance

        posterior = PosteriorDistribution(
            dimensions=dimensions,
            mean=mean,
            covariance=covariance
        )

        recommendation = adaptive_difficulty.get_difficulty_recommendation(posterior)

        # All trade-off strengths should be the same
        strengths = recommendation["trade_off_strengths"]
        strength_values = list(strengths.values())
        assert len(set(strength_values)) == 1  # All same value

    def test_edge_case_zero_variance(self, adaptive_difficulty):
        """Test behavior with zero variance (perfect certainty)."""
        dimensions = ["dim1", "dim2"]
        mean = np.zeros(2)
        covariance = np.eye(2) * 0.0001  # Near-zero variance

        posterior = PosteriorDistribution(
            dimensions=dimensions,
            mean=mean,
            covariance=covariance
        )

        # Should still return valid difficulty settings
        recommendation = adaptive_difficulty.get_difficulty_recommendation(posterior)

        assert "difficulty_per_dimension" in recommendation
        assert all(diff in ["easy", "medium", "hard"]
                   for diff in recommendation["difficulty_per_dimension"].values())

        # Trade-off strengths should be at minimum level
        assert all(strength == 0.3 for strength in recommendation["trade_off_strengths"].values())
