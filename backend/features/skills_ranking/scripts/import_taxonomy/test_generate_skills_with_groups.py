import logging

import pytest

from features.skills_ranking.scripts.import_taxonomy.generate_skills_with_groups import (
    SkillHierarchy,
    TaxonomyEntity,
    deduplicate_skill_hierarchies,
    filter_out_to_skills_links,
    get_parent_skill_groups_links,
    get_skill_groups_map,
    skills_with_parent_links_cache,
)


@pytest.fixture(autouse=True)
def clear_cache():
    skills_with_parent_links_cache.clear()
    yield
    skills_with_parent_links_cache.clear()

class TestUtilityFunctions:
    class TestFilterOutToSkillsLinks:
        def test_only_returns_group_parents(self):
            # GIVEN a set of mixed parent links (groups and skills)
            given_hierarchies = [
                SkillHierarchy(child_id="s1", child_type="skill", parent_id="g1", parent_type="skillgroup"),
                SkillHierarchy(child_id="s1", child_type="skill", parent_id="s2", parent_type="skill"),
                SkillHierarchy(child_id="s2", child_type="skill", parent_id="g2", parent_type="skillgroup"),
            ]

            # WHEN we filter to only skill group links
            actual_result = filter_out_to_skills_links(given_hierarchies)

            # THEN only links whose parent is a skill group remain
            expected_parent_ids = {"g1", "g2"}
            assert len(actual_result) == 2
            assert all(link.parent_type == "skillgroup" for link in actual_result)
            assert {link.parent_id for link in actual_result} == expected_parent_ids


    class TestDeduplicateSkillHierarchies:
        def test_deduplicate_by_parent_id(self):
            # GIVEN multiple links sharing the same parent id
            given_hierarchies = [
                SkillHierarchy(child_id="s1", child_type="skill", parent_id="g1", parent_type="skillgroup"),
                SkillHierarchy(child_id="s2", child_type="skill", parent_id="g1", parent_type="skillgroup"),
                SkillHierarchy(child_id="s3", child_type="skill", parent_id="g2", parent_type="skillgroup"),
            ]

            # WHEN we deduplicate
            actual_result = deduplicate_skill_hierarchies(given_hierarchies)

            # THEN only unique parent ids remain
            expected_parent_ids = {"g1", "g2"}
            assert len(actual_result) == 2
            assert {link.parent_id for link in actual_result} == expected_parent_ids


    class TestGetSkillGroupsMap:
        def test_build_lookup(self):
            # GIVEN a list of skill group entities
            given_groups = [
                TaxonomyEntity(id="g1", UUID="u1", preferred_label="Group 1"),
                TaxonomyEntity(id="g2", UUID="u2", preferred_label="Group 2"),
            ]

            # WHEN we build a map
            actual_result = get_skill_groups_map(given_groups)

            # THEN we can access groups by id
            assert actual_result["g1"].preferred_label ==  given_groups[0].preferred_label
            assert actual_result["g2"].preferred_label ==  given_groups[1].preferred_label


class TestGetParentSkillGroupsLinks:
    def test_direct_parent_group(self, caplog):
        caplog.set_level(logging.ERROR)

        # GIVEN s1 has a direct group parent g1 and a skill parent s2
        given_hierarchies = [
            SkillHierarchy(child_id="s1", child_type="skill", parent_id="g1", parent_type="skillgroup"),
            SkillHierarchy(child_id="s1", child_type="skill", parent_id="s2", parent_type="skill"),
        ]

        # WHEN we fetch parent group links for s1
        actual_result = get_parent_skill_groups_links(given_hierarchies, "s1")

        # THEN we get the direct group and no errors are logged
        assert len(actual_result) == 1
        assert actual_result[0].parent_id == "g1"
        assert not any("No parents found" in message for message in caplog.messages)


    def test_traverse_up_to_group(self):
        # GIVEN a chain s1 -> s2 -> g1
        given_hierarchies = [
            SkillHierarchy(child_id="s1", child_type="skill", parent_id="s2", parent_type="skill"),
            SkillHierarchy(child_id="s2", child_type="skill", parent_id="g1", parent_type="skillgroup"),
        ]

        # WHEN we fetch parent group links for s1
        actual_result = get_parent_skill_groups_links(given_hierarchies, "s1")

        # THEN the group g1 is found by traversal
        assert len(actual_result) == 1
        assert actual_result[0].parent_id == "g1"


    def test_handles_cycles(self):
        # GIVEN a cycle s1 -> s2 -> s1 and g1 attached to s2
        given_hierarchies = [
            SkillHierarchy(child_id="s1", child_type="skill", parent_id="s2", parent_type="skill"),
            SkillHierarchy(child_id="s2", child_type="skill", parent_id="s1", parent_type="skill"),
            SkillHierarchy(child_id="s2", child_type="skill", parent_id="g1", parent_type="skillgroup"),
        ]

        # WHEN we fetch parent group links for s1
        actual_result = get_parent_skill_groups_links(given_hierarchies, "s1")

        # THEN the traversal terminates and returns g1 exactly once
        assert len(actual_result) == 1
        assert actual_result[0].parent_id == "g1"


    def test_no_parents_logs_error_and_returns_empty(self, caplog):
        caplog.set_level(logging.ERROR)

        # GIVEN no hierarchies for s1
        given_hierarchies: list[SkillHierarchy] = []

        # WHEN we fetch parent group links
        actual_result = get_parent_skill_groups_links(given_hierarchies, "s1")

        # THEN an error is logged and result is empty
        assert actual_result == []
        assert any("No parents found for skill: s1" in message for message in caplog.messages)

    @pytest.mark.parametrize(
        "given_edges, given_skill_id, expected_group_ids",
        [
            # 1) Two direct skillgroup parents -> both returned
            # sg1 -> s1 AND sg2 -> s1 -> pick both sg1 and sg2
            (
                [
                    {"child": "s1", "child_type": "skill", "parent": "sg1", "parent_type": "skillgroup"},
                    {"child": "s1", "child_type": "skill", "parent": "sg2", "parent_type": "skillgroup"},
                ],
                "s1",
                {"sg1", "sg2"},
            ),
            # 2) parent skill has parent group, pick the group
            # sg1 -> s2 -> s1 -> pick sg1
            (
                [
                    {"child": "s1", "child_type": "skill", "parent": "s2", "parent_type": "skill"},
                    {"child": "s2", "child_type": "skill", "parent": "sg1", "parent_type": "skillgroup"},
                ],
                "s1",
                {"sg1"},
            ),
            # 3) parent skill has multiple parent groups, pick both
            # sg1 -> s2 -> s1 AND sg2 -> s2 -> s1
            # pick sg1 and sg2 (both groups on the path)
            (
                [
                    {"child": "s1", "child_type": "skill", "parent": "s2", "parent_type": "skill"},
                    {"child": "s2", "child_type": "skill", "parent": "sg1", "parent_type": "skillgroup"},
                    {"child": "s2", "child_type": "skill", "parent": "sg2", "parent_type": "skillgroup"},
                ],
                "s1",
                {"sg1", "sg2"},
            ),
            # 4) parent group has parent group, pick the first group on the path
            # sg2 -> sg1 -> s2 -> s1 -> pick sg1 and NOT sg2 (first group on the path)
            (
                [
                    {"child": "s1", "child_type": "skill", "parent": "s2", "parent_type": "skill"},
                    {"child": "s2", "child_type": "skill", "parent": "sg1", "parent_type": "skillgroup"},
                    {"child": "sg1", "child_type": "skillgroup", "parent": "sg2", "parent_type": "skillgroup"},
                ],
                "s1",
                {"sg1"},
            ),
            # 5) two parents with different paths, pick both
            # sg1 -> s2 -> s1 AND sg2 -> s3 -> s1 -> pick sg1 and sg2 (first group on each parent path)
            (
                [
                    {"child": "s1", "child_type": "skill", "parent": "s2", "parent_type": "skill"},
                    {"child": "s2", "child_type": "skill", "parent": "sg1", "parent_type": "skillgroup"},
                    {"child": "s1", "child_type": "skill", "parent": "s3", "parent_type": "skill"},
                    {"child": "s3", "child_type": "skill", "parent": "sg2", "parent_type": "skillgroup"},
                ],
                "s1",
                {"sg1", "sg2"},
            ),
            # 6) both a direct skillgroup parent and a skill parent with a group ancestor (pick only direct and not indirect)
            # sg1 -> s1 AND sg2 -> s3 -> s1 -> pick sg1 and NOT sg2 (direct group parent)
            (
                [
                    {"child": "s1", "child_type": "skill", "parent": "sg1", "parent_type": "skillgroup"},
                    {"child": "s1", "child_type": "skill", "parent": "s3", "parent_type": "skill"},
                    {"child": "s3", "child_type": "skill", "parent": "sg2", "parent_type": "skillgroup"},
                ],
                "s1",
                {"sg1"},
            ),
            # 7) should only get the first level skills' parent groups and not the next ones
            # sg1 -> s3 -> s2 -> s1  AND  sg2 -> s2 -> s1 -> AND sg3 -> s2 -> s1 pick sg2 and sg3 and NOT sg1 (first groups on the path)
            (
                [
                    {"child": "s1", "child_type": "skill", "parent": "s2", "parent_type": "skill"},
                    {"child": "s2", "child_type": "skill", "parent": "sg2", "parent_type": "skillgroup"},
                    {"child": "s2", "child_type": "skill", "parent": "sg3", "parent_type": "skillgroup"},
                    {"child": "s2", "child_type": "skill", "parent": "s3", "parent_type": "skill"},
                    {"child": "s3", "child_type": "skill", "parent": "sg1", "parent_type": "skillgroup"},
                ],
                "s1",
                {"sg2", "sg3"},
            ),
            # 8) should only get the first level skills' parent groups on all skill parents
            # sg1 -> s3 -> s2 -> s1  AND  sg2 -> s2 -> s1 -> AND sg3 -> s2 -> s1 AND sg4 -> s4 -> s1
            # pick sg2, sg3 and sg4 and NOT sg1 (first groups on the path)
            (
                    [
                        {"child": "s1", "child_type": "skill", "parent": "s2", "parent_type": "skill"},
                        {"child": "s2", "child_type": "skill", "parent": "sg2", "parent_type": "skillgroup"},
                        {"child": "s2", "child_type": "skill", "parent": "sg3", "parent_type": "skillgroup"},
                        {"child": "s2", "child_type": "skill", "parent": "s3", "parent_type": "skill"},
                        {"child": "s3", "child_type": "skill", "parent": "sg1", "parent_type": "skillgroup"},
                        {"child": "s4", "child_type": "skill", "parent": "sg4", "parent_type": "skillgroup"},
                        {"child": "s1", "child_type": "skill", "parent": "s4", "parent_type": "skill"},
                    ],
                    "s1",
                    {"sg2", "sg3", "sg4"},
            ),
        ],
        ids=[
            "Two direct skillgroup parents",
            "Parent skill has parent group",
            "Parent skill has multiple parent groups",
            "Parent group has parent group",
            "Two parents with different paths",
            "Direct and indirect skillgroup parents",
            "First level skillgroup parents only",
            "First level skillgroup parents on all skill parents",
        ]
    )
    def test_edge_cases(self, given_edges, given_skill_id, expected_group_ids):
        # GIVEN a set of hierarchy edges for skills and groups
        given_hierarchies = [
            SkillHierarchy(
                child_id=edge["child"],
                child_type=edge["child_type"],
                parent_id=edge["parent"],
                parent_type=edge["parent_type"],
            )
            for edge in given_edges
        ]

        # WHEN we search for the first skillgroup parents along all parent paths
        actual_links = get_parent_skill_groups_links(given_hierarchies, given_skill_id)

        # THEN the set of returned group ids matches the expected set
        actual_group_ids = {link.parent_id for link in actual_links}
        assert actual_group_ids == expected_group_ids