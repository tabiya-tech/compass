import datetime
from typing import AsyncIterator

from app.application_state import IApplicationStateManager, ApplicationState
from common_libs.test_utilities import get_random_session_id
from features.skills_ranking.ranking_service.services.ranking_service import IRankingService
from app.store.database_application_state_store_test import get_test_application_state
from features.skills_ranking.state.repositories.types import IRegistrationDataRepository
from features.skills_ranking.types import SkillsRankingScore, PriorBeliefs


def get_test_ranking_service():
    class TestRankingService(IRankingService):
        async def get_participant_ranking(self,
                                          *,
                                          user_id: str,
                                          prior_beliefs: PriorBeliefs,
                                          participants_skills_uuids: set[str]):

            return SkillsRankingScore(
                comparison_rank=0,
                jobs_matching_rank=0,
                comparison_label="",
                calculated_at=datetime.datetime.now()
            )

    return TestRankingService()


def get_test_application_state_manager():
    class TestApplicationStateManager(IApplicationStateManager):

        async def get_state(self, session_id: int) -> ApplicationState:
            return get_test_application_state(get_random_session_id())

        async def save_state(self, state: ApplicationState):
            pass

        async def delete_state(self, session_id: int) -> None:
            pass

        async def get_all_session_ids(self) -> AsyncIterator[int]:
            pass

    return TestApplicationStateManager()

def get_test_registration_data_repository():
    class TestRegistrationDataRepository(IRegistrationDataRepository):
        async def get_prior_beliefs(self, user_id: str) -> PriorBeliefs:
            return PriorBeliefs(
                opportunity_rank_prior_belief=0.0,
                compare_to_others_prior_belief=0.0
            )

    return TestRegistrationDataRepository()
