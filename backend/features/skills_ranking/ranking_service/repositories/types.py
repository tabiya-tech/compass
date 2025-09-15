from abc import ABC, abstractmethod
from typing import AsyncIterator

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

    async def update_job_seeker(self, job_seeker: JobSeeker):
        """
        Update jobseeker data in the repository.

        :param job_seeker: The jobseeker to update.
        :return: None
        """
        raise NotImplementedError


    def stream(self, batch_size: int = 100) -> AsyncIterator[JobSeeker]:
        """
        Stream jobseekers from the repository in batches.

        :param batch_size: The batch size to use when streaming jobseekers.
        :return:
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


class ITaxonomyRepository(ABC):
    """
    Interface for taxonomy repository/service to manage skills, skill groups from the taxonomy datasource (API or Database)
    """

    @abstractmethod
    async def get_skill_groups_from_skills(self, skills_uuids: set[str]) -> set[str]:
        """
        Get skill groups uuids from skill uuids.
        Uses taxonomy skill hierarchy, to determine the parent group for each skill.

        :param skills_uuids: The set of skill UUIDs to fetch skill groups for.
        :return: A list of skill groups associated with the given skills.
        """
        raise NotImplementedError
