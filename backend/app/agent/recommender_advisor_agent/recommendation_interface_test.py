"""
Unit tests for the BWS data wiring in `recommendation_interface._to_matching_preference_vector`.

These tests guard the wire contract with the matching service: when the recommender
has HB-derived BWS data, both `bws_scores` (per-WA posterior means) and `top_10_bws`
(HB-ranked WA IDs) must arrive on the outgoing `MatchingPreferenceVector`.
"""

from app.agent.preference_elicitation_agent.types import PreferenceVector
from app.agent.recommender_advisor_agent.recommendation_interface import (
    _to_matching_preference_vector,
)


def _agent_pref_vector() -> PreferenceVector:
    pv = PreferenceVector()
    pv.financial_importance = 0.8
    pv.work_life_balance_importance = 0.6
    pv.career_advancement_importance = 0.4
    pv.n_vignettes_completed = 4
    return pv


def test_bws_scores_and_top_10_bws_are_forwarded_when_provided():
    bws_scores = {"4.A.1.a.1": 1.4, "4.A.2.b.3": -0.8, "4.A.3.a.1": 0.1}
    top_10_bws = ["4.A.1.a.1", "4.A.3.a.1", "4.A.2.b.3"]

    out = _to_matching_preference_vector(
        _agent_pref_vector(),
        bws_scores=bws_scores,
        top_10_bws=top_10_bws,
    )

    assert out.bws_scores == bws_scores
    assert out.top_10_bws == top_10_bws


def test_bws_fields_default_to_none_when_not_provided():
    out = _to_matching_preference_vector(_agent_pref_vector())
    assert out.bws_scores is None
    assert out.top_10_bws is None


def test_bws_fields_forwarded_even_when_agent_pref_vector_is_none():
    bws_scores = {"4.A.1.a.1": 1.4}
    top_10_bws = ["4.A.1.a.1"]

    out = _to_matching_preference_vector(
        None,
        bws_scores=bws_scores,
        top_10_bws=top_10_bws,
    )

    assert out.bws_scores == bws_scores
    assert out.top_10_bws == top_10_bws
