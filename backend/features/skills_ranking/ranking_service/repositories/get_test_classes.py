from features.skills_ranking.ranking_service.repositories.types import IOpportunitiesDataRepository


def get_test_opportunities_data_repository(return_value: list[set[str]]):
    class TestOpportunitiesDataRepository(IOpportunitiesDataRepository):
        async def get_opportunities_skills_uuids(self, limit, batch_size) -> list[set[str]]:
            return return_value

    return TestOpportunitiesDataRepository()
