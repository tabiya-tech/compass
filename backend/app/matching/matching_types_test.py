from app.matching.matching_types import MatchingRequest, PreferenceVector, SkillsVector, Skill
from common_libs.test_utilities import get_random_user_id, get_random_printable_string


def test_matching_request_serialization():
    given_request = MatchingRequest(user_id="user-id",
                                    city="city",
                                    province="province",
                                    skills_vector=SkillsVector(
                                        top_skills=[
                                            Skill(
                                                origin_uuid="origin-uuid",
                                                preferred_label="preferred-label",
                                                proficiency=0.1
                                            )
                                        ]
                                    ),
                                    skill_groups_origin_uuids=[],
                                    preference_vector=PreferenceVector(
                                        earnings_per_month=0.1,
                                        task_content=0.1,
                                        physical_demand=0.1,
                                        work_flexibility=0.1,
                                        social_interaction=0.1,
                                        career_growth=0.1,
                                        social_meaning=0.1,
                                        bws_scores={
                                            "bws": 0.1
                                        },
                                        top_10_bws=["bws"]
                                    )
                                    )
    expected_json_request = {'city': 'city',
                             'preference_vector': {'bws_scores': {'bws': 0.1},
                                                   'career_growth': 0.1,
                                                   'earnings_per_month': 0.1,
                                                   'physical_demand': 0.1,
                                                   'social_interaction': 0.1,
                                                   'social_meaning': 0.1,
                                                   'task_content': 0.1,
                                                   'top_10_bws': ['bws'],
                                                   'work_flexibility': 0.1},
                             'province': 'province',
                             'skill_groups_origin_uuids': [],
                             'skills_vector': {'top_skills': [{'originUUID': 'origin-uuid',
                                                               'preferredLabel': 'preferred-label',
                                                               'proficiency': 0.1}]},
                             'user_id': 'user-id'}
    actual_json_request = given_request.to_json()
    assert actual_json_request == expected_json_request
