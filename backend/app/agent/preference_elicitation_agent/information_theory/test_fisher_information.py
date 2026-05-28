"""
Unit tests for FisherInformationCalculator.
"""

import pytest
import numpy as np
from app.agent.preference_elicitation_agent.information_theory.fisher_information import FisherInformationCalculator
from app.agent.preference_elicitation_agent.bayesian.likelihood_calculator import LikelihoodCalculator
from app.agent.preference_elicitation_agent.types import Vignette, VignetteOption


@pytest.fixture
def likelihood_calculator():
    """Create likelihood calculator with default temperature."""
    return LikelihoodCalculator(temperature=1.0)


@pytest.fixture
def fisher_calculator(likelihood_calculator):
    """Create Fisher Information calculator."""
    return FisherInformationCalculator(likelihood_calculator)


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


class TestFisherInformationCalculator:
    """Tests for FisherInformationCalculator class."""

    def test_init(self, likelihood_calculator):
        """Test initialization."""
        calc = FisherInformationCalculator(likelihood_calculator)
        assert calc.likelihood_calculator == likelihood_calculator

    def test_compute_fim_shape(self, fisher_calculator, simple_vignette, preference_weights):
        """Test that FIM has correct shape."""
        fim = fisher_calculator.compute_fim(simple_vignette, preference_weights)

        assert fim.shape == (7, 7)
        assert isinstance(fim, np.ndarray)

    def test_compute_fim_symmetric(self, fisher_calculator, simple_vignette, preference_weights):
        """Test that FIM is symmetric."""
        fim = fisher_calculator.compute_fim(simple_vignette, preference_weights)

        # Should be symmetric: FIM = FIMᵀ
        assert np.allclose(fim, fim.T)

    def test_compute_fim_positive_semidefinite(self, fisher_calculator, simple_vignette, preference_weights):
        """Test that FIM is positive semidefinite."""
        fim = fisher_calculator.compute_fim(simple_vignette, preference_weights)

        # All eigenvalues should be non-negative
        eigenvalues = np.linalg.eigvalsh(fim)
        assert all(ev >= -1e-10 for ev in eigenvalues)  # Allow small numerical errors

    def test_compute_fim_matches_formula(self, fisher_calculator, simple_vignette, preference_weights):
        """Test that FIM matches theoretical formula: I = p(A)×p(B)×(x_A-x_B)×(x_A-x_B)ᵀ."""
        # Manually compute expected FIM
        x_A = fisher_calculator.likelihood_calculator._extract_features(simple_vignette.options[0])
        x_B = fisher_calculator.likelihood_calculator._extract_features(simple_vignette.options[1])

        p_A = fisher_calculator.likelihood_calculator.compute_choice_likelihood(
            simple_vignette, "A", preference_weights
        )
        p_B = 1 - p_A

        x_diff = x_A - x_B
        expected_fim = p_A * p_B * np.outer(x_diff, x_diff)

        # Compute using method
        actual_fim = fisher_calculator.compute_fim(simple_vignette, preference_weights)

        # Should match
        assert np.allclose(actual_fim, expected_fim)

    def test_compute_fim_with_identical_options(self, fisher_calculator, preference_weights):
        """Test FIM with identical options (should be zero - no information)."""
        option_a = VignetteOption(
            option_id="A",
            title="Option A",
            attributes={"salary": 25000, "remote": True},
            description="A"
        )
        option_b = VignetteOption(
            option_id="B",
            title="Option B",
            attributes={"salary": 25000, "remote": True},
            description="B"
        )
        vignette = Vignette(
            vignette_id="test",
            category="financial",
            scenario_text="Test",
            options=[option_a, option_b]
        )

        fim = fisher_calculator.compute_fim(vignette, preference_weights)

        # Should be zero (no information from identical options)
        assert np.allclose(fim, 0, atol=1e-10)

    def test_compute_fim_maximum_information(self, fisher_calculator, preference_weights):
        """Test that FIM is maximized when p(A) = p(B) = 0.5 (maximum uncertainty)."""
        # Create vignette where options are balanced given preferences
        # With zero preference weights, p(A) = p(B) = 0.5
        zero_weights = np.zeros(7)

        option_a = VignetteOption(
            option_id="A",
            title="Option A",
            attributes={"salary": 20000},
            description="A"
        )
        option_b = VignetteOption(
            option_id="B",
            title="Option B",
            attributes={"salary": 30000},
            description="B"
        )
        vignette = Vignette(
            vignette_id="test",
            category="financial",
            scenario_text="Test",
            options=[option_a, option_b]
        )

        # With zero weights, should get maximum information
        fim_balanced = fisher_calculator.compute_fim(vignette, zero_weights)

        # With extreme weights, probabilities become 0 or 1, information drops
        extreme_weights = np.array([100.0, 0, 0, 0, 0, 0, 0])
        fim_extreme = fisher_calculator.compute_fim(vignette, extreme_weights)

        # Balanced should have higher information (larger determinant)
        det_balanced = fisher_calculator.compute_d_efficiency(fim_balanced)
        det_extreme = fisher_calculator.compute_d_efficiency(fim_extreme)

        assert det_balanced > det_extreme

    def test_compute_cumulative_fim(self, fisher_calculator, simple_vignette, preference_weights):
        """Test cumulative FIM across multiple vignettes."""
        vignettes = [simple_vignette, simple_vignette]  # Same vignette twice

        cumulative_fim = fisher_calculator.compute_cumulative_fim(vignettes, preference_weights)

        # Should be 2× single FIM
        single_fim = fisher_calculator.compute_fim(simple_vignette, preference_weights)
        expected_cumulative = 2 * single_fim

        assert np.allclose(cumulative_fim, expected_cumulative)

    def test_compute_cumulative_fim_empty_list(self, fisher_calculator, preference_weights):
        """Test cumulative FIM with empty vignette list."""
        cumulative_fim = fisher_calculator.compute_cumulative_fim([], preference_weights)

        # Should be zero matrix
        assert np.allclose(cumulative_fim, 0)
        assert cumulative_fim.shape == (7, 7)

    def test_compute_expected_fim(self, fisher_calculator, simple_vignette, preference_weights):
        """Test expected FIM computation."""
        current_fim = np.eye(7) * 0.1  # Some baseline information

        expected_new_fim, det_increase = fisher_calculator.compute_expected_fim(
            simple_vignette,
            preference_weights,
            current_fim
        )

        # Expected new FIM should be larger
        assert expected_new_fim.shape == (7, 7)

        # Determinant should increase
        current_det = fisher_calculator.compute_d_efficiency(current_fim)
        new_det = fisher_calculator.compute_d_efficiency(expected_new_fim)

        assert new_det > current_det
        assert np.isclose(det_increase, new_det - current_det)

    def test_compute_d_efficiency(self, fisher_calculator):
        """Test D-efficiency computation."""
        # Create known matrix
        fim = np.eye(7) * 2.0  # Determinant = 2^7 = 128

        d_eff = fisher_calculator.compute_d_efficiency(fim)

        # Should be positive
        assert d_eff > 0
        assert isinstance(d_eff, float)

    def test_compute_d_efficiency_with_singular_matrix(self, fisher_calculator):
        """Test D-efficiency with singular matrix (should handle gracefully)."""
        # Singular matrix (all zeros)
        singular_fim = np.zeros((7, 7))

        d_eff = fisher_calculator.compute_d_efficiency(singular_fim)

        # Should return 0 or small value, not crash
        assert d_eff >= 0
        assert d_eff < 1e-6

    def test_compute_d_efficiency_with_near_singular_matrix(self, fisher_calculator):
        """Test D-efficiency with nearly singular matrix (regularization)."""
        # Nearly singular (one very small eigenvalue)
        fim = np.diag([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1e-12])

        d_eff = fisher_calculator.compute_d_efficiency(fim)

        # Should handle numerical issues with regularization
        assert d_eff >= 0
        assert np.isfinite(d_eff)

    def test_get_information_per_dimension(self, fisher_calculator, simple_vignette, preference_weights):
        """Test getting information per dimension."""
        fim = fisher_calculator.compute_fim(simple_vignette, preference_weights)

        info_per_dim = fisher_calculator.get_information_per_dimension(fim)

        # Should return diagonal
        assert info_per_dim.shape == (7,)
        assert np.allclose(info_per_dim, np.diag(fim))

    def test_compute_information_gain(self, fisher_calculator, simple_vignette, preference_weights):
        """Test information gain computation."""
        current_uncertainty = 1.0

        info_gain = fisher_calculator.compute_information_gain(
            simple_vignette,
            preference_weights,
            current_uncertainty
        )

        # Should be positive (vignette provides information)
        assert info_gain >= 0
        assert isinstance(info_gain, (float, np.floating))

    def test_fim_increases_with_attribute_difference(self, fisher_calculator, preference_weights):
        """Test that FIM increases with larger attribute differences."""
        # Small difference
        option_a1 = VignetteOption(
            option_id="A",
            title="A",
            attributes={"salary": 25000},
            description="A"
        )
        option_b1 = VignetteOption(
            option_id="B",
            title="B",
            attributes={"salary": 26000},
            description="B"
        )
        vignette_small = Vignette(
            vignette_id="test1",
            category="financial",
            scenario_text="Test",
            options=[option_a1, option_b1]
        )

        # Large difference
        option_a2 = VignetteOption(
            option_id="A",
            title="A",
            attributes={"salary": 15000},
            description="A"
        )
        option_b2 = VignetteOption(
            option_id="B",
            title="B",
            attributes={"salary": 35000},
            description="B"
        )
        vignette_large = Vignette(
            vignette_id="test2",
            category="financial",
            scenario_text="Test",
            options=[option_a2, option_b2]
        )

        fim_small = fisher_calculator.compute_fim(vignette_small, preference_weights)
        fim_large = fisher_calculator.compute_fim(vignette_large, preference_weights)

        # Larger difference should give more information
        det_small = fisher_calculator.compute_d_efficiency(fim_small)
        det_large = fisher_calculator.compute_d_efficiency(fim_large)

        assert det_large > det_small

    def test_numerical_stability_with_extreme_weights(self, fisher_calculator, simple_vignette):
        """Test numerical stability with very large weights."""
        extreme_weights = np.array([1000.0, 0, 0, 0, 0, 0, 0])

        fim = fisher_calculator.compute_fim(simple_vignette, extreme_weights)

        # Should not have NaN or Inf
        assert not np.any(np.isnan(fim))
        assert not np.any(np.isinf(fim))

    def test_expected_fim_determinant_increase_is_nonnegative(
        self, fisher_calculator, simple_vignette, preference_weights
    ):
        """Test that adding a vignette never decreases determinant."""
        current_fim = np.eye(7) * 0.5

        _, det_increase = fisher_calculator.compute_expected_fim(
            simple_vignette,
            preference_weights,
            current_fim
        )

        # Adding information should increase or maintain determinant
        assert det_increase >= -1e-10  # Allow small numerical errors
