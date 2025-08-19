import pytest

from features.skills_ranking.ranking_service.services.ranking_service import RankingService


class TestGetComparisonLabel:
    @pytest.mark.parametrize(
        "participant_rank,comparison_label", [
            (0.0, "LOWEST"),  # Edge case for the lowest rank
            (0.05, "LOWEST"),
            (0.15, "LOWEST"),
            (0.2, "SECOND LOWEST"),  # Edge case for the second lowest threshold
            (0.23, "SECOND LOWEST"),
            (0.4, "MIDDLE"),  # Edge case for the middle threshold
            (0.5, "MIDDLE"),
            (0.6, "SECOND HIGHEST"),  # Edge case for the second highest threshold
            (0.7, "SECOND HIGHEST"),
            (0.8, "HIGHEST"),  # Edge case for the highest threshold
            (0.9, "HIGHEST"),
            (1.0, "HIGHEST"),  # Edge case for the highest rank
        ])
    def test_get_comparison_label(self, participant_rank, comparison_label):
        # GIVEN a participant rank
        given_participant_rank = participant_rank

        # WHEN the comparison label is computed
        ranking_service = RankingService(None, None, None, None)  # type: ignore not used in this test
        actual_comparison_label = ranking_service._get_comparison_label(given_participant_rank)

        # THEN the actual comparison label matches the expected value
        assert actual_comparison_label == comparison_label


    @pytest.mark.parametrize(
        "participant_rank", [
            -0.1,  # Below the minimum valid rank
            1.1,   # Above the maximum valid rank
            2.0,   # Significantly above the maximum valid rank
            -0.5,  # Negative rank
        ]
    )
    def test_get_comparison_label_invalid_rank(self, participant_rank):
        # GIVEN an invalid participant rank
        given_participant_rank = participant_rank

        # WHEN the comparison label is computed
        ranking_service = RankingService(None, None, None, None)  # type: ignore not used in this test

        # THEN it raises a ValueError
        with pytest.raises(ValueError):
            ranking_service._get_comparison_label(given_participant_rank)
