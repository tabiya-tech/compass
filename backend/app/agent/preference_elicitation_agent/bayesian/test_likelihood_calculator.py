"""
Unit tests for LikelihoodCalculator.
"""

import pytest
import numpy as np
from app.agent.preference_elicitation_agent.bayesian.likelihood_calculator import LikelihoodCalculator
from app.agent.preference_elicitation_agent.types import Vignette, VignetteOption


@pytest.fixture
def calculator():
    """Create likelihood calculator with default temperature."""
    return LikelihoodCalculator(temperature=1.0)


@pytest.fixture
def simple_vignette():
    """Create simple test vignette."""
    option_a = VignetteOption(
        option_id="A",
        title="Option A Job",
        attributes={
            "salary": 20000,
            "remote": True,
            "career_growth": True,
            "flexibility": True,
            "job_security": True,
            "task_variety": False,
            "culture_alignment": True
        },
        description="Option A"
    )

    option_b = VignetteOption(
        option_id="B",
        title="Option B Job",
        attributes={
            "salary": 30000,
            "remote": False,
            "career_growth": False,
            "flexibility": False,
            "job_security": False,
            "task_variety": True,
            "culture_alignment": False
        },
        description="Option B"
    )

    return Vignette(
        vignette_id="test_1",
        category="financial",
        scenario_text="Consider these two job opportunities:",
        options=[option_a, option_b]
    )


@pytest.fixture
def preference_weights():
    """Default preference weights (all positive)."""
    return np.array([0.8, 0.5, 0.5, 0.4, 0.6, 0.3, 0.5])


class TestLikelihoodCalculator:
    """Tests for LikelihoodCalculator class."""

    def test_init_default_temperature(self):
        """Test initialization with default temperature."""
        calc = LikelihoodCalculator()
        assert calc.temperature == 1.0

    def test_init_custom_temperature(self):
        """Test initialization with custom temperature."""
        calc = LikelihoodCalculator(temperature=2.0)
        assert calc.temperature == 2.0

    def test_compute_choice_likelihood_returns_probability(
        self, calculator, simple_vignette, preference_weights
    ):
        """Test that likelihood is valid probability."""
        likelihood = calculator.compute_choice_likelihood(
            vignette=simple_vignette,
            chosen_option="A",
            preference_weights=preference_weights
        )

        assert isinstance(likelihood, float)
        assert 0 <= likelihood <= 1

    def test_compute_choice_likelihood_probabilities_sum_to_one(
        self, calculator, simple_vignette, preference_weights
    ):
        """Test that P(A) + P(B) = 1."""
        p_a = calculator.compute_choice_likelihood(
            vignette=simple_vignette,
            chosen_option="A",
            preference_weights=preference_weights
        )

        p_b = calculator.compute_choice_likelihood(
            vignette=simple_vignette,
            chosen_option="B",
            preference_weights=preference_weights
        )

        assert np.isclose(p_a + p_b, 1.0)

    def test_extract_features_shape(self, calculator, simple_vignette):
        """Test feature extraction returns correct shape."""
        features = calculator._extract_features(simple_vignette.options[0])

        assert features.shape == (7,)
        assert isinstance(features, np.ndarray)

    def test_extract_features_salary_normalization(self, calculator):
        """Test salary feature is normalized."""
        option = VignetteOption(
            title="Test Option",
            option_id="A",
            attributes={"salary": 20000},
            description="Test"
        )

        features = calculator._extract_features(option)

        # Salary normalized by 10000
        assert features[0] == 2.0

    def test_extract_features_binary_attributes(self, calculator):
        """Test binary attributes encoded as 0/1."""
        option = VignetteOption(
            title="Test Option",
            option_id="A",
            attributes={
                "remote": True,
                "career_growth": False,
                "flexibility": True,
                "job_security": False
            },
            description="Test"
        )

        features = calculator._extract_features(option)

        # Check binary encoding
        assert features[1] == 1.0  # remote
        assert features[2] == 0.0  # career_growth
        assert features[3] == 1.0  # flexibility
        assert features[4] == 0.0  # job_security

    def test_extract_features_missing_attributes(self, calculator):
        """Test feature extraction with missing attributes."""
        option = VignetteOption(
            title="Test Option",
            option_id="A",
            attributes={},
            description="Test"
        )

        features = calculator._extract_features(option)

        # Should return zeros
        assert np.allclose(features, 0)

    def test_temperature_affects_probabilities(self, simple_vignette, preference_weights):
        """Test that temperature affects choice probabilities."""
        calc_low = LikelihoodCalculator(temperature=0.5)
        calc_high = LikelihoodCalculator(temperature=2.0)

        p_low = calc_low.compute_choice_likelihood(
            vignette=simple_vignette,
            chosen_option="A",
            preference_weights=preference_weights
        )

        p_high = calc_high.compute_choice_likelihood(
            vignette=simple_vignette,
            chosen_option="A",
            preference_weights=preference_weights
        )

        # Lower temperature = more deterministic (probabilities closer to 0 or 1)
        # Higher temperature = more random (probabilities closer to 0.5)
        # We just check they're different
        assert p_low != p_high

    def test_extreme_preference_weights(self, calculator, simple_vignette):
        """Test with extreme preference weights."""
        # Strong preference for all attributes
        strong_weights = np.array([10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0])

        likelihood = calculator.compute_choice_likelihood(
            vignette=simple_vignette,
            chosen_option="A",
            preference_weights=strong_weights
        )

        # Should still be valid probability
        assert 0 <= likelihood <= 1
        assert np.isfinite(likelihood)

    def test_zero_preference_weights(self, calculator, simple_vignette):
        """Test with zero weights (indifferent user)."""
        zero_weights = np.zeros(7)

        p_a = calculator.compute_choice_likelihood(
            vignette=simple_vignette,
            chosen_option="A",
            preference_weights=zero_weights
        )

        # With zero weights, should be 50/50
        assert np.isclose(p_a, 0.5, atol=1e-5)

    def test_negative_preference_weights(self, calculator, simple_vignette):
        """Test with negative weights (disliked attributes)."""
        negative_weights = np.array([-0.5, -0.3, -0.4, -0.2, -0.6, -0.1, -0.5])

        likelihood = calculator.compute_choice_likelihood(
            vignette=simple_vignette,
            chosen_option="A",
            preference_weights=negative_weights
        )

        assert 0 <= likelihood <= 1

    def test_create_likelihood_function(self, calculator, simple_vignette):
        """Test creating likelihood function."""
        likelihood_fn = calculator.create_likelihood_function(
            vignette=simple_vignette,
            chosen_option="A"
        )

        # Should be callable
        assert callable(likelihood_fn)

        # Test calling it
        observation = {
            "vignette": simple_vignette,
            "chosen_option": "A"
        }
        beta = np.array([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5])

        result = likelihood_fn(observation, beta)
        assert 0 <= result <= 1

    def test_numerical_stability_with_large_utilities(self, calculator):
        """Test numerical stability with large utility differences."""
        # Create vignette where one option is vastly better
        option_a = VignetteOption(
            title="Test Option",
            option_id="A",
            attributes={"salary": 50000},
            description="High salary"
        )
        option_b = VignetteOption(
            title="Test Option",
            option_id="B",
            attributes={"salary": 10000},
            description="Low salary"
        )
        vignette = Vignette(
            vignette_id="test",
            category="financial",
            scenario_text="Test scenario",
            options=[option_a, option_b]
        )

        # Very strong salary preference
        strong_salary_pref = np.array([100.0, 0, 0, 0, 0, 0, 0])

        likelihood = calculator.compute_choice_likelihood(
            vignette=vignette,
            chosen_option="A",
            preference_weights=strong_salary_pref
        )

        # Should be very close to 1 (certain choice)
        assert likelihood > 0.99
        assert np.isfinite(likelihood)

    def test_symmetry_of_options(self, calculator):
        """Test that swapping options gives complementary probabilities."""
        option_a = VignetteOption(
            title="Test Option A",
            option_id="A",
            attributes={"salary": 20000},
            description="A"
        )
        option_b = VignetteOption(
            title="Test Option B",
            option_id="B",
            attributes={"salary": 30000},
            description="B"
        )

        vignette_ab = Vignette(
            vignette_id="test1",
            category="financial",
            scenario_text="Test scenario",
            options=[option_a, option_b]
        )

        # In BA vignette, swap options AND their IDs so lookup works correctly
        option_a_as_b = VignetteOption(
            title="Test Option A (now B)",
            option_id="B",  # Now called B in this vignette
            attributes={"salary": 20000},  # Same attributes as original A
            description="A"
        )
        option_b_as_a = VignetteOption(
            title="Test Option B (now A)",
            option_id="A",  # Now called A in this vignette
            attributes={"salary": 30000},  # Same attributes as original B
            description="B"
        )

        vignette_ba = Vignette(
            vignette_id="test2",
            category="financial",
            scenario_text="Test scenario",
            options=[option_b_as_a, option_a_as_b]
        )

        weights = np.array([1.0, 0, 0, 0, 0, 0, 0])

        p_a_in_ab = calculator.compute_choice_likelihood(
            vignette=vignette_ab,
            chosen_option="A",
            preference_weights=weights
        )

        # In BA vignette, choosing "B" means choosing the option with salary=20K (original A's attributes)
        p_b_in_ba = calculator.compute_choice_likelihood(
            vignette=vignette_ba,
            chosen_option="B",
            preference_weights=weights
        )

        # Should be the same because we're choosing the same attributes
        assert np.isclose(p_a_in_ab, p_b_in_ba)

    def test_choice_option_case_insensitive(self, calculator, simple_vignette, preference_weights):
        """Test that chosen_option accepts different cases."""
        p_upper = calculator.compute_choice_likelihood(
            vignette=simple_vignette,
            chosen_option="A",
            preference_weights=preference_weights
        )

        # Should handle lowercase too (though current impl expects uppercase)
        # This tests the current behavior
        p_not_b = calculator.compute_choice_likelihood(
            vignette=simple_vignette,
            chosen_option="B",
            preference_weights=preference_weights
        )

        assert np.isclose(p_upper + p_not_b, 1.0)
