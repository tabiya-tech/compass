from uuid import uuid4

import pytest
from bson import ObjectId

from features.skills_ranking.ranking_service.repositories.taxonomy_mongo_repository import TaxonomyMongoRepository

class TestTaxonomyMongoRepository:
    @pytest.mark.asyncio
    async def test_get_skill_groups_uuids_by_skill_uuids(self, in_memory_opportunity_data_db):

        # GIVEN a skill in the opportunity database.
        given_skill_group = {
            "_id": ObjectId(),
            "UUID": uuid4().__str__(),
        }

        given_skill = {
            "_id": ObjectId(),
            "UUID": uuid4().__str__(),
            "skillGroups": [
                given_skill_group,
                given_skill_group # add duplicates, and expect them to be deduplicated
            ]
        }

        given_skills = [ given_skill ]
        skills_collection_name = "skills"
        await in_memory_opportunity_data_db.get_collection(skills_collection_name).insert_many(given_skills)

        # WHEN we get the skill groups by skill UUIDs.
        taxonomy_mongo_repository = TaxonomyMongoRepository(
            db=in_memory_opportunity_data_db,
            skills_collection_name=skills_collection_name
        )

        skill_uuids = {given_skill.get("UUID")}
        skill_groups = await taxonomy_mongo_repository.get_skill_groups_from_skills(skill_uuids)

        # THEN we should get the skill groups associated with the skills.
        assert skill_groups == {given_skill_group.get("UUID")}
