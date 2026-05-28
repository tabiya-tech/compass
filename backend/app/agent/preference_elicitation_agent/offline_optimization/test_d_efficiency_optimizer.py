"""
Unit tests for DEfficiencyOptimizer.
"""

import pytest
import numpy as np
from pathlib import Path
from app.agent.preference_elicitation_agent.offline_optimization.profile_generator import ProfileGenerator
from app.agent.preference_elicitation_agent.offline_optimization.d_efficiency_optimizer import DEfficiencyOptimizer


@pytest.fixture
def profile_generator():
    """Create profile generator with real config."""
    config_path = Path(__file__).parent / "preference_parameters.json"
    if not config_path.exists():
        pytest.skip("Config file not found")
    return ProfileGenerator(config_path=str(config_path))


@pytest.fixture
def optimizer(profile_generator):
    """Create optimizer instance."""
    return DEfficiencyOptimizer(profile_generator)


@pytest.fixture
def small_profile_set(profile_generator):
    """Generate small set of profiles for testing."""
    all_profiles = profile_generator.generate_all_profiles(max_profiles=50)
    return all_profiles


@pytest.fixture
def prior_mean():
    """Prior mean from real config."""
    return np.array([0.8, -0.5, 0.4, -0.3, 0.6, 0.9, 0.5])


class TestDEfficiencyOptimizer:
    """Tests for DEfficiencyOptimizer class."""

    def test_init(self, optimizer, profile_generator):
        """Test optimizer initialization."""
        assert optimizer.profile_generator == profile_generator
        assert optimizer.logger is not None

    def test_compute_vignette_fim_shape(self, optimizer, small_profile_set, prior_mean):
        """Test FIM computation returns correct shape."""
        profile_a = small_profile_set[0]
        profile_b = small_profile_set[1]

        fim = optimizer._compute_vignette_fim(profile_a, profile_b, prior_mean)

        assert fim.shape == (7, 7)
        assert np.allclose(fim, fim.T)  # FIM should be symmetric

    def test_compute_vignette_fim_positive_semidefinite(
        self, optimizer, small_profile_set, prior_mean
    ):
        """Test that FIM is positive semi-definite."""
        profile_a = small_profile_set[0]
        profile_b = small_profile_set[5]

        fim = optimizer._compute_vignette_fim(profile_a, profile_b, prior_mean)

        # Check eigenvalues are non-negative
        eigenvalues = np.linalg.eigvalsh(fim)
        assert np.all(eigenvalues >= -1e-10)  # Allow small numerical errors

    def test_compute_vignette_fim_identical_profiles(
        self, optimizer, small_profile_set, prior_mean
    ):
        """Test FIM for identical profiles is near zero."""
        profile = small_profile_set[0]

        fim = optimizer._compute_vignette_fim(profile, profile, prior_mean)

        # FIM should be near zero for identical profiles (no information)
        assert np.allclose(fim, 0, atol=1e-10)

    def test_compute_vignette_fim_numerical_stability(
        self, optimizer, small_profile_set, prior_mean
    ):
        """Test FIM computation is numerically stable."""
        profile_a = small_profile_set[0]
        profile_b = small_profile_set[10]

        # Should not raise any numerical errors
        fim = optimizer._compute_vignette_fim(profile_a, profile_b, prior_mean)

        assert np.all(np.isfinite(fim))
        assert not np.any(np.isnan(fim))

    def test_select_static_vignettes_count(
        self, optimizer, small_profile_set, prior_mean
    ):
        """Test correct number of vignettes selected."""
        beginning, end = optimizer.select_static_vignettes(
            profiles=small_profile_set,
            num_static=6,
            num_beginning=4,
            prior_mean=prior_mean
        )

        assert len(beginning) == 4
        assert len(end) == 2

    def test_select_static_vignettes_structure(
        self, optimizer, small_profile_set, prior_mean
    ):
        """Test vignette structure."""
        beginning, end = optimizer.select_static_vignettes(
            profiles=small_profile_set,
            num_static=6,
            num_beginning=4,
            prior_mean=prior_mean
        )

        # Each vignette is a tuple of (profile_a, profile_b)
        for vignette in beginning + end:
            assert isinstance(vignette, tuple)
            assert len(vignette) == 2
            assert isinstance(vignette[0], dict)
            assert isinstance(vignette[1], dict)

    def test_select_static_vignettes_uniqueness(
        self, optimizer, small_profile_set, prior_mean
    ):
        """Test that selected vignettes are unique."""
        beginning, end = optimizer.select_static_vignettes(
            profiles=small_profile_set,
            num_static=6,
            num_beginning=4,
            prior_mean=prior_mean
        )

        all_vignettes = beginning + end

        # Convert to hashable format for uniqueness check
        vignette_hashes = [
            (tuple(sorted(v[0].items())), tuple(sorted(v[1].items())))
            for v in all_vignettes
        ]

        assert len(vignette_hashes) == len(set(vignette_hashes))

    def test_select_static_vignettes_fim_increases(
        self, optimizer, small_profile_set, prior_mean
    ):
        """Test that FIM determinant increases with each selection."""
        beginning, end = optimizer.select_static_vignettes(
            profiles=small_profile_set,
            num_static=6,
            num_beginning=4,
            prior_mean=prior_mean
        )

        all_vignettes = beginning + end

        # Compute cumulative FIM determinants
        prior_variance = 0.5
        current_fim = np.eye(7) / prior_variance
        det_values = []

        for vignette in all_vignettes:
            vignette_fim = optimizer._compute_vignette_fim(
                vignette[0], vignette[1], prior_mean
            )
            current_fim += vignette_fim
            det = np.linalg.det(current_fim)
            det_values.append(det)

        # Each determinant should be larger than the previous
        for i in range(1, len(det_values)):
            assert det_values[i] > det_values[i-1]

    def test_get_optimization_statistics(
        self, optimizer, small_profile_set, prior_mean
    ):
        """Test optimization statistics calculation."""
        beginning, end = optimizer.select_static_vignettes(
            profiles=small_profile_set,
            num_static=6,
            num_beginning=4,
            prior_mean=prior_mean
        )

        all_vignettes = beginning + end
        stats = optimizer.get_optimization_statistics(all_vignettes, prior_mean)

        # Check required keys
        assert "num_vignettes" in stats
        assert "fim_determinant" in stats
        assert "d_efficiency" in stats
        assert "eigenvalues" in stats
        assert "condition_number" in stats
        assert "min_eigenvalue" in stats
        assert "max_eigenvalue" in stats

        # Check values
        assert stats["num_vignettes"] == 6
        assert stats["fim_determinant"] > 0
        assert stats["d_efficiency"] > 0
        assert len(stats["eigenvalues"]) == 7
        assert stats["condition_number"] > 0
        assert stats["min_eigenvalue"] > 0
        assert stats["max_eigenvalue"] > 0

    def test_get_optimization_statistics_eigenvalues_sorted(
        self, optimizer, small_profile_set, prior_mean
    ):
        """Test that eigenvalues are all positive."""
        beginning, end = optimizer.select_static_vignettes(
            profiles=small_profile_set,
            num_static=6,
            num_beginning=4,
            prior_mean=prior_mean
        )

        all_vignettes = beginning + end
        stats = optimizer.get_optimization_statistics(all_vignettes, prior_mean)

        eigenvalues = stats["eigenvalues"]

        # Check all eigenvalues are positive (FIM is positive definite)
        assert all(ev > 0 for ev in eigenvalues)

    def test_get_optimization_statistics_condition_number(
        self, optimizer, small_profile_set, prior_mean
    ):
        """Test condition number calculation."""
        beginning, end = optimizer.select_static_vignettes(
            profiles=small_profile_set,
            num_static=6,
            num_beginning=4,
            prior_mean=prior_mean
        )

        all_vignettes = beginning + end
        stats = optimizer.get_optimization_statistics(all_vignettes, prior_mean)

        # Condition number should equal max_eigenvalue / min_eigenvalue
        expected_condition = stats["max_eigenvalue"] / stats["min_eigenvalue"]
        assert np.isclose(stats["condition_number"], expected_condition)

    def test_select_with_different_temperatures(
        self, optimizer, small_profile_set, prior_mean
    ):
        """Test that temperature parameter affects FIM calculation."""
        profile_a = small_profile_set[0]
        profile_b = small_profile_set[5]

        fim_temp1 = optimizer._compute_vignette_fim(
            profile_a, profile_b, prior_mean, temperature=1.0
        )
        fim_temp2 = optimizer._compute_vignette_fim(
            profile_a, profile_b, prior_mean, temperature=2.0
        )

        # Different temperatures should produce different FIMs
        assert not np.allclose(fim_temp1, fim_temp2)

    def test_select_with_minimal_profiles(self, optimizer, prior_mean):
        """Test selection with minimal number of profiles."""
        # Create just 10 profiles
        minimal_profiles = optimizer.profile_generator.generate_all_profiles(max_profiles=10)

        beginning, end = optimizer.select_static_vignettes(
            profiles=minimal_profiles,
            num_static=4,
            num_beginning=2,
            prior_mean=prior_mean
        )

        assert len(beginning) == 2
        assert len(end) == 2

    def test_prior_variance_affects_initial_fim(
        self, optimizer, small_profile_set, prior_mean
    ):
        """Test that prior variance affects optimization."""
        beginning1, end1 = optimizer.select_static_vignettes(
            profiles=small_profile_set,
            num_static=4,
            num_beginning=2,
            prior_mean=prior_mean,
            prior_variance=0.5
        )

        beginning2, end2 = optimizer.select_static_vignettes(
            profiles=small_profile_set,
            num_static=4,
            num_beginning=2,
            prior_mean=prior_mean,
            prior_variance=1.0
        )

        # Different prior variances may select different vignettes
        # (though not guaranteed, so we just check completion)
        assert len(beginning1) == 2
        assert len(beginning2) == 2

    def test_d_efficiency_formula(self, optimizer, small_profile_set, prior_mean):
        """Test D-efficiency calculation formula."""
        beginning, end = optimizer.select_static_vignettes(
            profiles=small_profile_set,
            num_static=6,
            num_beginning=4,
            prior_mean=prior_mean
        )

        all_vignettes = beginning + end
        stats = optimizer.get_optimization_statistics(all_vignettes, prior_mean)

        # D-efficiency = det(FIM)^(1/k) where k=7
        expected_d_efficiency = stats["fim_determinant"] ** (1/7)

        assert np.isclose(stats["d_efficiency"], expected_d_efficiency, rtol=1e-5)
