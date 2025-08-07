from abc import ABC

from features.skills_ranking.ranking_service.types import JobSeeker


class IJobSeekersRepository(ABC):
    """
    Interface for jobseeker repository to manage jobseeker data and their ranks.
    """

    async def get_job_seekers_ranks(self, batch_size: int) -> list[float]:
        """
        Get all jobseeker opportunity ranks.

        :param batch_size: The number of jobseekers to process in each batch.
        :return: A list of jobseeker opportunity ranks.
        """
        raise NotImplementedError

    async def save_job_seeker_rank(self, job_seeker: JobSeeker) -> None:
        """
        Save jobseeker rank.
        """
        raise NotImplementedError


class IOpportunitiesDataRepository(ABC):
    """
    Interface for opportunities data repository to manage skills data from opportunities.
    """

    async def get_opportunities_skills_uuids(self, limit: int, batch_size: int) -> list[set[str]]:
        """
        Get skills from opportunity data.

        :return: The list of sets of skills UUIDs from opportunities.
        :param limit: The maximum number of opportunities to fetch.
        :param batch_size: The number of opportunities to process in each batch.

        :raises Exception: If an error fetching skills from opportunities.
        """
        raise NotImplementedError
