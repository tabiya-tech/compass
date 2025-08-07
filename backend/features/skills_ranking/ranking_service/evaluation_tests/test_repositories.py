import json
import os

from features.skills_ranking.ranking_service.evaluation_tests._types import IntegrationTestCase
from features.skills_ranking.ranking_service.repositories.types import IJobSeekersRepository
from features.skills_ranking.ranking_service.services.opportunities_data_service import IOpportunitiesDataService
from features.skills_ranking.ranking_service.types import JobSeeker

CURRENT_FILE_DIR = os.path.dirname(os.path.abspath(__file__))
TEST_DATA_FILES_PATH = os.path.join(CURRENT_FILE_DIR, 'test_data')


class TestOpportunitiesDataService(IOpportunitiesDataService):
    def __init__(self):
        with open(os.path.join(TEST_DATA_FILES_PATH, 'opportunities.json'), 'r') as file:
            self._test_opportunities_data = json.load(file)

    async def get_opportunities_skills_uuids(self):
        # for each opportunity, extract the UUIDs of the skills
        skills_uuids = [
            {skill.get("uuid") for skill in opportunity.get("given_skills", []) if skill.get("uuid")} for opportunity in
            self._test_opportunities_data
        ]

        return skills_uuids


class TestJobSeekersDataRepository(IJobSeekersRepository):
    def __init__(self):
        with open(os.path.join(TEST_DATA_FILES_PATH, 'integration_test_data.json'), 'r') as file:
            self._test_job_seekers_data = json.load(file)

        with(open(os.path.join(TEST_DATA_FILES_PATH, 'job_seekers_skills.json'), 'r')) as file:
            self._job_seekers_skills = json.load(file)

    async def get_job_seekers_ranks(self, batch_size: int) -> list[float]:
        return [job_seeker.get("expected_opportunity_rank") for job_seeker in self._test_job_seekers_data]

    def get_test_cases(self) -> list[IntegrationTestCase]:
        print(self._test_job_seekers_data)
        return [IntegrationTestCase(**test_case) for test_case in self._test_job_seekers_data]

    async def save_job_seeker_rank(self, job_seeker: JobSeeker) -> None:
        return None

    def get_skills_by_external_user_id(self, external_user_id: str) -> set[str]:
        """
        Get the skills associated with a jobseeker by their external user ID.
        """
        # find the jobseeker skills by external user ID
        job_seeker_skills = next(job_seeker.get("given_skills") for job_seeker in self._job_seekers_skills if
                                 job_seeker.get("given_external_user_id") == external_user_id)

        # return the set of skill UUIDs for the jobseeker
        return {skill.get("uuid") for skill in job_seeker_skills}
