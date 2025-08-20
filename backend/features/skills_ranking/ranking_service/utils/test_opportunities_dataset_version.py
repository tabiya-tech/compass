import pytest
from datetime import datetime

import features.skills_ranking.ranking_service.utils.opportunities_dataset_version as mod
from common_libs.test_utilities import get_random_printable_string


def _get_doc(
    active: bool = True,
    occ: str = get_random_printable_string(10),
    text: str = get_random_printable_string(100),
    title: str = get_random_printable_string(10),
    url: str = get_random_printable_string(10),
    posted=datetime.now().timestamp(),
    uuids=None,
    groups=None,
):
    return {
        "active": active,
        "occupation": occ,
        "opportunityText": text,
        "opportunityTitle": title,
        "opportunityUrl": url,
        "postedAt": posted,
        "skills": [{"UUID": u} for u in (uuids or [])],
        "skillGroups": groups,
    }


def test_dataset_version_is_deterministic_for_reordered_docs():
    # GIVEN two lists with the same docs in different orders
    given_docs = [_get_doc(uuids=["skill_3", "skill_1"]), _get_doc(uuids=["skill_2"]) ]
    given_docs_reordered = [_get_doc(uuids=["skill_2"]) , _get_doc(uuids=["skill_1", "skill_3"]) ]

    # WHEN we compute the versions
    actual_version_1 = mod.compute_opportunities_dataset_version_from_docs(given_docs)
    actual_version_2 = mod.compute_opportunities_dataset_version_from_docs(given_docs_reordered)

    # THEN the versions should be equal
    assert actual_version_1 == actual_version_2


def test_dataset_version_changes_when_meaningful_data_changes():
    # GIVEN two lists of docs with different skills
    given_docs = [_get_doc(uuids=["skill_1", "skill_2"]) ]
    given_docs_changed = [_get_doc(uuids=["skill_1", "skill_2", "skill_3"]) ]

    # WHEN we compute the versions
    actual_version_original = mod.compute_opportunities_dataset_version_from_docs(given_docs)
    actual_version_changed = mod.compute_opportunities_dataset_version_from_docs(given_docs_changed)

    # THEN the versions should be different
    assert actual_version_original != actual_version_changed


def test_dataset_version_includes_textual_fields():
    # GIVEN two documents that differ only by a textual field
    given_doc_a = [_get_doc(text="opportunity_text_variant_A")] 
    given_doc_b = [_get_doc(text="opportunity_text_variant_B")] 

    # WHEN we compute the versions
    actual_version_a = mod.compute_opportunities_dataset_version_from_docs(given_doc_a)
    actual_version_b = mod.compute_opportunities_dataset_version_from_docs(given_doc_b)

    # THEN the versions should be different
    assert actual_version_a != actual_version_b


@pytest.mark.parametrize(
    "given_skill_groups_a,given_skill_groups_b,should_be_equal",
    [
        (None, None, True),
        ({"groups": ["group 1", "group 2"]}, {"groups": ["group 1", "group 2"]}, True),
        ({"groups": ["group 1", "group 2"]}, {"groups": ["group 2", "group 1"]}, False),
        ({"groups": ["group 1"]}, {"groups": ["group 1", "group 2"]}, False),
        ({"groups": {"key": "value"}}, {"groups": {"key": "another value"}}, False),
    ],
)
def test_dataset_version_skill_groups_variants(given_skill_groups_a, given_skill_groups_b, should_be_equal):
    # GIVEN two docs differing only by skillGroups
    given_doc_a = [_get_doc(uuids=["skill_1"], groups=given_skill_groups_a)]
    given_doc_b = [_get_doc(uuids=["skill_1"], groups=given_skill_groups_b)]

    # WHEN computing versions
    version_a = mod.compute_opportunities_dataset_version_from_docs(given_doc_a)
    version_b = mod.compute_opportunities_dataset_version_from_docs(given_doc_b)

    # THEN equality matches expectation
    assert (version_a == version_b) is should_be_equal


def test_dataset_version_is_independent_of_skills_order_within_doc():
    # GIVEN two documents with the same skills in different order
    given_doc_a = [_get_doc(uuids=["skill_3", "skill_1", "skill_2"])]
    given_doc_b = [_get_doc(uuids=["skill_2", "skill_1", "skill_3"])]

    # WHEN computing versions
    version_a = mod.compute_opportunities_dataset_version_from_docs(given_doc_a)
    version_b = mod.compute_opportunities_dataset_version_from_docs(given_doc_b)

    # THEN equal
    assert version_a == version_b


@pytest.mark.parametrize("active_a,active_b,should_be_equal", [(True, True, True), (True, False, False)])
def test_dataset_version_reflects_active_flag(active_a, active_b, should_be_equal):
    # GIVEN two docs differing only by active flag
    given_doc_a = [_get_doc(active=active_a)]
    given_doc_b = [_get_doc(active=active_b)]

    # WHEN
    version_a = mod.compute_opportunities_dataset_version_from_docs(given_doc_a)
    version_b = mod.compute_opportunities_dataset_version_from_docs(given_doc_b)

    # THEN
    assert (version_a == version_b) is should_be_equal


@pytest.mark.parametrize(
    "posted_a,posted_b,should_be_equal",
    [
        (123, 123, True),
        (123, "123", False),
        (datetime(2025, 1, 1), datetime(2025, 1, 1), True),
        (datetime(2025, 1, 1), datetime(2025, 1, 2), False),
    ],
)
def test_dataset_version_reflects_posted_at(posted_a, posted_b, should_be_equal):
    # GIVEN two docs differing only by postedAt
    given_doc_a = [_get_doc(posted=posted_a)]
    given_doc_b = [_get_doc(posted=posted_b)]

    # WHEN computing versions
    version_a = mod.compute_opportunities_dataset_version_from_docs(given_doc_a)
    version_b = mod.compute_opportunities_dataset_version_from_docs(given_doc_b)

    # THEN equality matches expectation
    assert (version_a == version_b) is should_be_equal


