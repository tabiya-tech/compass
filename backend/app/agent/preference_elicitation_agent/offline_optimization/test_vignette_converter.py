"""
Unit tests for VignetteConverter.

Covers:
- category_rotation assignment in convert_vignette_list
- rotation cycling when there are more vignettes than categories
- scenario_text updates to match the assigned category
- infer_category fallback when no rotation is provided
"""

import pytest
from pathlib import Path
from app.agent.preference_elicitation_agent.offline_optimization.profile_generator import ProfileGenerator
from app.agent.preference_elicitation_agent.offline_optimization.vignette_converter import VignetteConverter


@pytest.fixture
def real_converter():
    """VignetteConverter using the real preference_parameters.json config."""
    config_path = Path(__file__).parent / "preference_parameters.json"
    if not config_path.exists():
        pytest.skip("preference_parameters.json not found")
    pg = ProfileGenerator(config_path=str(config_path))
    return VignetteConverter(pg)


@pytest.fixture
def two_vignette_pairs(real_converter):
    """Two minimal vignette pairs with all attributes differing."""
    pg = real_converter.profile_generator
    profiles = pg.generate_all_profiles(max_profiles=4)
    return [(profiles[0], profiles[1]), (profiles[2], profiles[3])]


class TestCategoryRotation:
    """Tests for convert_vignette_list category_rotation parameter."""

    def test_rotation_overrides_inferred_category(self, real_converter, two_vignette_pairs):
        """Categories from rotation take precedence over inference."""
        rotation = ["financial", "job_security"]
        result = real_converter.convert_vignette_list(
            two_vignette_pairs,
            id_prefix="test",
            category_rotation=rotation
        )

        assert result[0]["category"] == "financial"
        assert result[1]["category"] == "job_security"

    def test_rotation_cycles_when_more_vignettes_than_categories(self, real_converter, two_vignette_pairs):
        """Rotation wraps around when vignette count exceeds category list length."""
        rotation = ["financial"]  # only one category for two vignettes
        result = real_converter.convert_vignette_list(
            two_vignette_pairs,
            id_prefix="test",
            category_rotation=rotation
        )

        assert result[0]["category"] == "financial"
        assert result[1]["category"] == "financial"  # cycles back

    def test_rotation_updates_targeted_dimensions(self, real_converter, two_vignette_pairs):
        """targeted_dimensions matches the assigned category."""
        rotation = ["career_advancement", "work_life_balance"]
        result = real_converter.convert_vignette_list(
            two_vignette_pairs,
            id_prefix="test",
            category_rotation=rotation
        )

        assert result[0]["targeted_dimensions"] == ["career_advancement"]
        assert result[1]["targeted_dimensions"] == ["work_life_balance"]

    def test_rotation_updates_scenario_text(self, real_converter, two_vignette_pairs):
        """scenario_text is regenerated to match the assigned category."""
        rotation = ["job_security", "career_advancement"]
        result = real_converter.convert_vignette_list(
            two_vignette_pairs,
            id_prefix="test",
            category_rotation=rotation
        )

        assert "job security" in result[0]["scenario_text"].lower()
        assert "growth" in result[1]["scenario_text"].lower()

    def test_no_rotation_uses_inference(self, real_converter, two_vignette_pairs):
        """Without rotation, category is inferred from attribute differences."""
        result = real_converter.convert_vignette_list(
            two_vignette_pairs,
            id_prefix="test",
            category_rotation=None
        )

        valid_categories = {
            "financial", "work_environment", "job_security",
            "career_advancement", "work_life_balance", "task_preferences",
            "values_culture", "mixed"
        }
        for v in result:
            assert v["category"] in valid_categories

    def test_full_static_rotation_covers_all_required_categories(self, real_converter, two_vignette_pairs):
        """The 6-category rotation used in production covers all categories_to_explore."""
        production_rotation = [
            "financial",
            "work_environment",
            "job_security",
            "career_advancement",
            "work_life_balance",
            "task_preferences",
        ]
        # Simulate 7 static vignettes (5 beginning + 2 end share same rotation)
        pairs = two_vignette_pairs * 4  # 8 pairs — more than enough
        result = real_converter.convert_vignette_list(
            pairs[:7],
            id_prefix="static_begin",
            category_rotation=production_rotation
        )

        assigned = [v["category"] for v in result]
        # All 6 required categories must appear at least once across 7 vignettes
        assert set(production_rotation).issubset(set(assigned))

    def test_vignette_ids_use_correct_prefix_and_index(self, real_converter, two_vignette_pairs):
        """Vignette IDs follow the expected prefix_NNN format."""
        result = real_converter.convert_vignette_list(
            two_vignette_pairs,
            id_prefix="static_begin",
            category_rotation=["financial", "job_security"]
        )

        assert result[0]["vignette_id"] == "static_begin_001"
        assert result[1]["vignette_id"] == "static_begin_002"
