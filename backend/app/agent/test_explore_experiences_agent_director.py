from app.agent.explore_experiences_agent_director import _map_and_dedup_skill_labels
from app.vector_search.esco_entities import SkillEntity
from features.skills_granularity.skill_parent_mapping_store import set_cache_for_tests, clear_cache_for_tests


def _skill(skill_id: str, label: str) -> SkillEntity:
    return SkillEntity(
        id=skill_id,
        UUID=skill_id,
        preferredLabel=label,
        altLabels=[],
        description="",
        score=0.0,
        skillType="skill/competence",
    )


def test_map_and_dedup_skill_labels_uses_parent_and_removes_duplicates():
    # GIVEN two child skills that map to the same parent and one unmapped skill
    set_cache_for_tests({
        "child-1": "Parent Skill",
        "child-2": "Parent Skill",
    })

    skills = [
        _skill("child-1", "Child One"),
        _skill("child-2", "Child Two"),
        _skill("child-3", "Unmapped Child"),
    ]

    # WHEN mapping and deduplicating
    labels = _map_and_dedup_skill_labels(skills)

    # THEN parent label appears once and unmapped child is preserved
    assert labels == ["Parent Skill", "Unmapped Child"]

    clear_cache_for_tests()
