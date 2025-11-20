import datetime
from typing import AsyncIterator

from app.application_state import IApplicationStateManager, ApplicationState
from app.store.database_application_state_store_test import get_test_application_state
from common_libs.test_utilities import get_random_session_id, get_random_printable_string
from features.skills_ranking.services.skills_ranking_service import SkillsRankingService
from features.skills_ranking.state.repositories.types import IRegistrationDataRepository
from features.skills_ranking.types import SkillsRankingScore, PriorBeliefs


def get_test_http_client():
    class TestHttpClient(SkillsRankingService):
        def __init__(self):
            # Don't call super().__init__ since we don't need real HTTP client
            pass

        async def get_participant_ranking(self,
                                          user_id: str,
                                          prior_beliefs: PriorBeliefs,
                                          participants_skills_uuids: set[str],
                                          taxonomy_model_id: str):
            return SkillsRankingScore(
                calculated_at=datetime.datetime.now(),
                above_average_labels=[get_random_printable_string(8)],
                below_average_labels=[get_random_printable_string(8)],
                most_demanded_label=get_random_printable_string(8),
                most_demanded_percent=60.0,
                least_demanded_label=get_random_printable_string(8),
                least_demanded_percent=10.0,
                average_percent_for_jobseeker_skill_groups=45.0,
                average_count_for_jobseeker_skill_groups=300.0,
                province_used=get_random_printable_string(8),
                matched_skill_groups=5,
            )

    return TestHttpClient()


def get_test_application_state_manager():
    class TestApplicationStateManager(IApplicationStateManager):

        async def get_state(self, session_id: int) -> ApplicationState:
            return get_test_application_state(get_random_session_id())

        async def save_state(self, state: ApplicationState):
            # left empty for testing purposes
            pass

        async def delete_state(self, session_id: int) -> None:
            # left empty for testing purposes
            pass

        async def get_all_session_ids(self) -> AsyncIterator[int]:
            # left empty for testing purposes
            pass

    return TestApplicationStateManager()


def get_test_registration_data_repository():
    class TestRegistrationDataRepository(IRegistrationDataRepository):
        async def get_prior_beliefs(self, user_id: str) -> PriorBeliefs:
            return PriorBeliefs(
                external_user_id=get_random_printable_string(10),
                opportunity_rank_prior_belief=0.0,
                compare_to_others_prior_belief=0.0
            )

    return TestRegistrationDataRepository()
