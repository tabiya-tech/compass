import logging

from motor.motor_asyncio import AsyncIOMotorDatabase

from features.skills_ranking.ranking_service.repositories.types import ITaxonomyRepository


class TaxonomyMongoRepository(ITaxonomyRepository):
    def __init__(self,
                 *,
                 db: AsyncIOMotorDatabase,
                 skills_collection_name: str):

        self._logger = logging.getLogger(self.__class__.__name__)
        self._skills_collection = db.get_collection(skills_collection_name)

    async def get_skill_groups_from_skills(self, skills_uuids: set[str]) -> set[str]:
        try:
            if len(skills_uuids) == 0:
                self._logger.warning("No skills UUIDs provided, returning empty skill group set.")
                return set()

            skills = await self._skills_collection.find(
                {"UUID": {"$in": list(skills_uuids)}},
                {"skillGroups.UUID": 1}
            ).to_list(None)  # Fetch all matching skills because we need to process them all.

            if len(skills) != len(skills_uuids):
                # we are detecting if the skills discovered, # are the same as the skills we were looking for
                self._logger.error("Not all skills were found in the database.")

            skill_groups = []
            for skill in skills:
                skill_groups.extend([skill_group.get("UUID") for skill_group in skill.get("skillGroups", [])])

            return set(skill_groups)
        except Exception as e:
            self._logger.exception(
                f"Failed to get skill groups from skills, returning empty skill group set, reason {e}")
            return set()
