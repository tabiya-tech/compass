import json
import os
from uuid import uuid4

from features.skills_ranking.ranking_service.repositories.types import IJobSeekersRepository
from features.skills_ranking.ranking_service.services.opportunities_data_service import IOpportunitiesDataService
from features.skills_ranking.ranking_service.services.types import JobSeeker

CURRENT_FILE_DIR = os.path.dirname(os.path.abspath(__file__))
TEST_DATA_FILES_PATH = os.path.join(CURRENT_FILE_DIR, 'test_data')


class TestOpportunitiesDataService(IOpportunitiesDataService):
    def __init__(self):
        with open(os.path.join(TEST_DATA_FILES_PATH, 'opportunities.json'), 'r') as file:
            self._test_opportunities_data = json.load(file)

    async def get_opportunities_skills_uuids(self):
        skills_uuids = [
            {skill.get("uuid") for skill in opportunity.get("skills", []) if skill.get("uuid")} for opportunity in self._test_opportunities_data
        ]

        # filter out empty and None values
        return skills_uuids


class TestJobSeekersDataRepository(IJobSeekersRepository):
    def __init__(self):
        with open(os.path.join(TEST_DATA_FILES_PATH, 'job_seekers.json'), 'r') as file:
            self._test_job_seekers_data = json.load(file)

    async def get_job_seekers_ranks(self, batch_size: int) -> list[float]:
        return [job_seeker.get("opportunityRank") for job_seeker in self._test_job_seekers_data]

    def get_all_job_seekers(self):
        return [JobSeeker(
            user_id=uuid4().__str__(),
            skills_uuids={skill.get("uuid") for skill in job_seeker.get("skills", [])},
            opportunity_rank=job_seeker.get("opportunityRank", 0.0),
            compared_to_others_rank=job_seeker.get("comparedToOthersRank", 0.0),
            prior_belief=0.0
        ) for job_seeker in self._test_job_seekers_data]

    async def save_job_seeker_rank(self, job_seeker: JobSeeker) -> None:
        return None
