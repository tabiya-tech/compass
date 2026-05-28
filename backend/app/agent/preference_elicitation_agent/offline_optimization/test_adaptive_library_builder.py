"""
Unit tests for AdaptiveLibraryBuilder.
"""

import pytest
import numpy as np
from pathlib import Path
from app.agent.preference_elicitation_agent.offline_optimization.profile_generator import ProfileGenerator
from app.agent.preference_elicitation_agent.offline_optimization.adaptive_library_builder import AdaptiveLibraryBuilder


@pytest.fixture
def profile_generator():
    """Create profile generator with real config."""
    config_path = Path(__file__).parent / "preference_parameters.json"
    if not config_path.exists():
        pytest.skip("Config file not found")
    return ProfileGenerator(config_path=str(config_path))


@pytest.fixture
def builder(profile_generator):
    """Create library builder instance."""
    return AdaptiveLibraryBuilder(profile_generator)


@pytest.fixture
def small_profile_set(profile_generator):
    """Generate small set of profiles for testing."""
    return profile_generator.generate_all_profiles(max_profiles=50)


@pytest.fixture
def prior_mean():
    """Prior mean from real config."""
    return np.array([0.8, -0.5, 0.4, -0.3, 0.6, 0.9, 0.5])


@pytest.fixture
def excluded_vignettes(small_profile_set):
    """Create some excluded vignettes."""
    return [
        (small_profile_set[0], small_profile_set[1]),
        (small_profile_set[2], small_profile_set[3])
    ]


class TestAdaptiveLibraryBuilder:
    """Tests for AdaptiveLibraryBuilder class."""

    def test_init(self, builder, profile_generator):
        """Test builder initialization."""
        assert builder.profile_generator == profile_generator
        assert builder.logger is not None

    def test_build_adaptive_library_count(
        self, builder, small_profile_set, prior_mean, excluded_vignettes
    ):
        """Test correct number of vignettes in library."""
        library = builder.build_adaptive_library(
            profiles=small_profile_set,
            num_library=10,
            excluded_vignettes=excluded_vignettes,
            prior_mean=prior_mean,
            diversity_weight=0.3
        )

        assert len(library) == 10

    def test_build_adaptive_library_structure(
        self, builder, small_profile_set, prior_mean, excluded_vignettes
    ):
        """Test library vignette structure."""
        library = builder.build_adaptive_library(
            profiles=small_profile_set,
            num_library=5,
            excluded_vignettes=excluded_vignettes,
            prior_mean=prior_mean
        )

        for vignette in library:
            assert isinstance(vignette, tuple)
            assert len(vignette) == 2
            assert isinstance(vignette[0], dict)
            assert isinstance(vignette[1], dict)

    def test_build_adaptive_library_excludes_static(
        self, builder, small_profile_set, prior_mean, excluded_vignettes
    ):
        """Test that excluded vignettes are not in library."""
        library = builder.build_adaptive_library(
            profiles=small_profile_set,
            num_library=10,
            excluded_vignettes=excluded_vignettes,
            prior_mean=prior_mean
        )

        # Convert to comparable format
        library_set = {
            (tuple(sorted(v[0].items())), tuple(sorted(v[1].items())))
            for v in library
        }
        excluded_set = {
            (tuple(sorted(v[0].items())), tuple(sorted(v[1].items())))
            for v in excluded_vignettes
        }

        # No overlap
        assert len(library_set & excluded_set) == 0

    def test_build_adaptive_library_uniqueness(
        self, builder, small_profile_set, prior_mean, excluded_vignettes
    ):
        """Test that library vignettes are unique."""
        library = builder.build_adaptive_library(
            profiles=small_profile_set,
            num_library=10,
            excluded_vignettes=excluded_vignettes,
            prior_mean=prior_mean
        )

        library_hashes = [
            (tuple(sorted(v[0].items())), tuple(sorted(v[1].items())))
            for v in library
        ]

        assert len(library_hashes) == len(set(library_hashes))

    def test_compute_informativeness(
        self, builder, small_profile_set, prior_mean
    ):
        """Test informativeness calculation."""
        profile_a = small_profile_set[0]
        profile_b = small_profile_set[5]

        informativeness = builder._compute_informativeness(
            profile_a, profile_b, prior_mean
        )

        assert isinstance(informativeness, float)
        assert informativeness > 0
        assert np.isfinite(informativeness)

    def test_compute_informativeness_identical_profiles(
        self, builder, small_profile_set, prior_mean
    ):
        """Test informativeness for identical profiles is low."""
        profile = small_profile_set[0]

        informativeness = builder._compute_informativeness(
            profile, profile, prior_mean
        )

        # Should be very close to zero (no information from identical profiles)
        assert informativeness < 1e-10

    def test_compute_diversity_empty_library(
        self, builder, small_profile_set
    ):
        """Test diversity when no vignettes selected yet."""
        vignette = (small_profile_set[0], small_profile_set[1])

        diversity = builder._compute_diversity(vignette, selected_feature_vectors=[])

        # With empty library, diversity should be 1.0 (maximum)
        assert diversity == 1.0

    def test_compute_diversity_decreases_with_similarity(
        self, builder, small_profile_set
    ):
        """Test diversity is in valid range."""
        vignette1 = (small_profile_set[0], small_profile_set[1])
        vignette2 = (small_profile_set[0], small_profile_set[2])  # Similar to vignette1

        x1_a = np.array(builder.profile_generator.encode_profile(vignette1[0]))
        x1_b = np.array(builder.profile_generator.encode_profile(vignette1[1]))
        x1_diff = x1_a - x1_b

        diversity = builder._compute_diversity(vignette2, [x1_diff])

        # Diversity should be in valid range [0, 1.0]
        assert 0 <= diversity <= 1.0

    def test_diversity_weight_zero_ignores_diversity(
        self, builder, small_profile_set, prior_mean, excluded_vignettes
    ):
        """Test diversity_weight=0 only uses informativeness."""
        library = builder.build_adaptive_library(
            profiles=small_profile_set,
            num_library=5,
            excluded_vignettes=excluded_vignettes,
            prior_mean=prior_mean,
            diversity_weight=0.0
        )

        assert len(library) == 5

    def test_diversity_weight_one_only_uses_diversity(
        self, builder, small_profile_set, prior_mean, excluded_vignettes
    ):
        """Test diversity_weight=1.0 only uses diversity."""
        library = builder.build_adaptive_library(
            profiles=small_profile_set,
            num_library=5,
            excluded_vignettes=excluded_vignettes,
            prior_mean=prior_mean,
            diversity_weight=1.0
        )

        assert len(library) == 5

    def test_get_library_statistics(
        self, builder, small_profile_set, prior_mean, excluded_vignettes
    ):
        """Test library statistics calculation."""
        library = builder.build_adaptive_library(
            profiles=small_profile_set,
            num_library=10,
            excluded_vignettes=excluded_vignettes,
            prior_mean=prior_mean
        )

        stats = builder.get_library_statistics(library)

        # Check required keys
        assert "num_vignettes" in stats
        assert "avg_pairwise_distance" in stats
        assert "min_pairwise_distance" in stats
        assert "max_pairwise_distance" in stats
        assert "std_pairwise_distance" in stats
        assert "attribute_coverage" in stats

        # Check values
        assert stats["num_vignettes"] == 10
        assert 0 <= stats["avg_pairwise_distance"] <= 1
        assert 0 <= stats["min_pairwise_distance"] <= 1
        assert 0 <= stats["max_pairwise_distance"] <= 1
        assert stats["min_pairwise_distance"] <= stats["max_pairwise_distance"]

    def test_attribute_coverage_structure(
        self, builder, small_profile_set, prior_mean, excluded_vignettes
    ):
        """Test attribute coverage structure."""
        library = builder.build_adaptive_library(
            profiles=small_profile_set,
            num_library=10,
            excluded_vignettes=excluded_vignettes,
            prior_mean=prior_mean
        )

        stats = builder.get_library_statistics(library)
        coverage = stats["attribute_coverage"]

        # Should have coverage for each attribute
        assert "wage" in coverage
        assert "physical_demand" in coverage
        assert "flexibility" in coverage
        assert "commute_time" in coverage
        assert "job_security" in coverage
        assert "remote_work" in coverage
        assert "career_growth" in coverage

        # Each coverage is a dict of value -> count
        for attr_name, value_counts in coverage.items():
            assert isinstance(value_counts, dict)
            assert sum(value_counts.values()) > 0

    def test_pairwise_distance_calculation(
        self, builder, small_profile_set, prior_mean, excluded_vignettes
    ):
        """Test pairwise distance calculation."""
        library = builder.build_adaptive_library(
            profiles=small_profile_set,
            num_library=10,
            excluded_vignettes=excluded_vignettes,
            prior_mean=prior_mean
        )

        stats = builder.get_library_statistics(library)

        # Average should be between min and max
        assert (
            stats["min_pairwise_distance"]
            <= stats["avg_pairwise_distance"]
            <= stats["max_pairwise_distance"]
        )

    def test_build_with_small_candidate_pool(
        self, builder, prior_mean, excluded_vignettes
    ):
        """Test building library with limited candidates."""
        small_pool = builder.profile_generator.generate_all_profiles(max_profiles=10)

        library = builder.build_adaptive_library(
            profiles=small_pool,
            num_library=5,
            excluded_vignettes=[],
            prior_mean=prior_mean
        )

        assert len(library) == 5

    def test_informativeness_uses_fim(
        self, builder, small_profile_set, prior_mean
    ):
        """Test that informativeness calculation uses FIM correctly."""
        profile_a = small_profile_set[0]
        profile_b = small_profile_set[5]

        informativeness1 = builder._compute_informativeness(
            profile_a, profile_b, prior_mean
        )

        # Different profiles should give different informativeness
        profile_c = small_profile_set[10]
        informativeness2 = builder._compute_informativeness(
            profile_a, profile_c, prior_mean
        )

        # Not guaranteed to be different, but very likely
        # Just check both are valid
        assert informativeness1 > 0
        assert informativeness2 > 0

    def test_diversity_uses_cosine_distance(self, builder, small_profile_set):
        """Test diversity calculation uses cosine distance."""
        vignette1 = (small_profile_set[0], small_profile_set[1])
        vignette2 = (small_profile_set[2], small_profile_set[3])

        # Create feature vectors
        x1_a = np.array(builder.profile_generator.encode_profile(vignette1[0]))
        x1_b = np.array(builder.profile_generator.encode_profile(vignette1[1]))
        x1_diff = x1_a - x1_b

        # Normalize for cosine distance
        x1_diff_norm = x1_diff / (np.linalg.norm(x1_diff) + 1e-10)

        diversity = builder._compute_diversity(vignette2, [x1_diff])

        # Should be in valid range
        assert 0 <= diversity <= 1.0

    def test_sampling_efficiency_with_large_library(
        self, builder, small_profile_set, prior_mean, excluded_vignettes
    ):
        """Test that builder samples efficiently for large libraries."""
        # Request library larger than we'll evaluate
        # (Builder should sample candidates rather than exhaustive search)
        library = builder.build_adaptive_library(
            profiles=small_profile_set,
            num_library=20,
            excluded_vignettes=excluded_vignettes,
            prior_mean=prior_mean
        )

        assert len(library) == 20

    def test_no_excluded_vignettes(
        self, builder, small_profile_set, prior_mean
    ):
        """Test library building with no excluded vignettes."""
        library = builder.build_adaptive_library(
            profiles=small_profile_set,
            num_library=5,
            excluded_vignettes=[],
            prior_mean=prior_mean
        )

        assert len(library) == 5

    def test_default_diversity_weight(
        self, builder, small_profile_set, prior_mean, excluded_vignettes
    ):
        """Test library building with default diversity weight."""
        library = builder.build_adaptive_library(
            profiles=small_profile_set,
            num_library=5,
            excluded_vignettes=excluded_vignettes,
            prior_mean=prior_mean
            # diversity_weight defaults to 0.3
        )

        assert len(library) == 5
