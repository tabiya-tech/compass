from unittest.mock import Mock
from uuid import uuid4

import pytest

from features.skills_ranking.ranking_service.repositories.opportunities_data_mongo_repository import \
    OpportunitiesDataRepository

given_skills_uuids = [uuid4().__str__() for _ in range(10)]
given_test_opportunities_data = [
    {
        "active": True,
        "skillGroups": [{"UUID": given_skills_uuids[0]}, {"UUID": given_skills_uuids[1]}]
    },
    {
        "active": False,
        "skillGroups": [{"UUID": given_skills_uuids[2]}, {"UUID": given_skills_uuids[3]}]
    },
    {
        "active": True,
        "skillGroups": [{"UUID": given_skills_uuids[4]}, {"UUID": given_skills_uuids[5]}, {"UUID": given_skills_uuids[6]}]
    },
    {
        "active": True,
        "skillGroups": [{"UUID": given_skills_uuids[6]}, {"UUID": given_skills_uuids[7]}]
    },
    {
        "active": True,
        "skillGroups": [{"UUID": given_skills_uuids[8]}, {"UUID": given_skills_uuids[9]}]
    },
    {
        "active": True,
        "skillGroups": [{"UUID": given_skills_uuids[7]}, {"UUID": given_skills_uuids[5]}]
    },
    {
        "active": True,
        "skillGroups": [{"UUID": given_skills_uuids[3]}, {"UUID": given_skills_uuids[8]}]
    }
]
expected_opportunities_skills_uuids = [
    {given_skills_uuids[0], given_skills_uuids[1]},
    # The second opportunity is inactive, so it should not be included in the results
    {given_skills_uuids[4], given_skills_uuids[5], given_skills_uuids[6]},
    {given_skills_uuids[6], given_skills_uuids[7]},
    {given_skills_uuids[8], given_skills_uuids[9]},
    {given_skills_uuids[7], given_skills_uuids[5]}
    # the last opportunity is ignored because the limit is 5
]


class TestGetOpportunitiesSkillsUUIDs:
    @pytest.mark.asyncio
    async def test_get_opportunities_skills_uuids_success(self, in_memory_opportunity_data_db):
        # GIVEN an instance of OpportunitiesData Database
        given_in_memory_opportunity_data_db = in_memory_opportunity_data_db

        # AND given the collection name is 'opportunity_data'
        collection_name = "opportunity_data"

        # AND some opportunity data is inserted into the in-memory database

        await given_in_memory_opportunity_data_db.get_collection(collection_name).insert_many(
            given_test_opportunities_data)

        # AND the opportunity data repository is created
        opportunities_data_repository = OpportunitiesDataRepository(given_in_memory_opportunity_data_db,
                                                                    collection_name)

        # AND given some query params
        given_limit = 5
        given_batch_size = 2

        # WHEN the repository.get_opportunities_skills_uuids is called with the given params
        skills_uuids = await opportunities_data_repository.get_opportunities_skills_uuids(given_limit, given_batch_size)

        # THEN the skills uuids should be returned
        assert skills_uuids == expected_opportunities_skills_uuids


    @pytest.mark.asyncio
    async def test_collection_throws_an_error(self, mocker):
        # GIVEN an instance of OpportunitiesData Database
        given_in_memory_opportunity_data_db = Mock()

        # AND given the collection name is 'opportunity_data'
        collection_name = "opportunity_data"

        # AND the opportunity data repository is created
        opportunities_data_repository = OpportunitiesDataRepository(given_in_memory_opportunity_data_db,
                                                                    collection_name)

        class _GivenException(Exception):
            pass

        given_exception = _GivenException("Collection error")
        mocker.patch.object(opportunities_data_repository._collection, "find", side_effect=given_exception)

        # WHEN the repository.get_opportunities_skills_uuids is called with the given params
        with pytest.raises(_GivenException):
            await opportunities_data_repository.get_opportunities_skills_uuids(0, 0)


    @pytest.mark.asyncio
    async def test_no_opportunities_found(self, in_memory_opportunity_data_db, caplog):
        # GIVEN an empty in-memory opportunities database
        given_in_memory_opportunity_data_db = in_memory_opportunity_data_db
        collection_name = "opportunity_data"

        # AND the opportunity data repository is created
        opportunities_data_repository = OpportunitiesDataRepository(given_in_memory_opportunity_data_db,
                                                                    collection_name)

        # WHEN the repository.get_opportunities_skills_uuids is called with the given params
        skills_uuids = await opportunities_data_repository.get_opportunities_skills_uuids(0, 0)

        # THEN the skills uuids should be an empty list
        assert skills_uuids == []

        # AND an error should be logged because no opportunities were found
        assert "No active opportunities found in the database." in caplog.text


class TestGetOpportunities:
    @pytest.mark.asyncio
    async def test_get_opportunities_success(self, in_memory_opportunity_data_db):
        # GIVEN an instance of OpportunitiesData Database
        given_in_memory_opportunity_data_db = in_memory_opportunity_data_db

        collection_name = "opportunity_data"

        # AND some opportunity data is inserted into the in-memory database
        given_docs = [
            {
                "active": True,
                "occupation": "occ-1",
                "opportunityText": "text-1",
                "opportunityTitle": "title-1",
                "opportunityUrl": "http://example.com/1",
                "postedAt": 111,
                "skills": [{"UUID": "u1"}, {"UUID": "u2"}],
                # missing skillGroups on purpose
                "extraField": "ignore-me",
            },
            {
                "active": False,
                "occupation": "occ-2",
                "opportunityText": "text-2",
                "opportunityTitle": "title-2",
                "opportunityUrl": "http://example.com/2",
                "postedAt": 222,
                "skills": [{"UUID": "u3"}],
                "skillGroups": {"group": ["g1", "g2"]},
            },
            {
                "active": True,
                "occupation": "occ-3",
                "opportunityText": "text-3",
                "opportunityTitle": "title-3",
                "opportunityUrl": "http://example.com/3",
                "postedAt": 333,
                "skills": [],
                "skillGroups": None,
            },
        ]

        await given_in_memory_opportunity_data_db.get_collection(collection_name).insert_many(given_docs)

        repo = OpportunitiesDataRepository(given_in_memory_opportunity_data_db, collection_name)

        # WHEN fetching with a limit smaller than total
        result = await repo.get_opportunities(limit=2, batch_size=2)

        # THEN we get only projected fields and only 2 docs
        assert len(result) == 2
        for doc in result:
            # Ensure no _id or extra fields leaked
            assert "_id" not in doc
            assert "extraField" not in doc
            # Ensure all projected keys exist (optional skillGroups may be absent)
            assert {"active", "occupation", "opportunityText", "opportunityTitle", "opportunityUrl", "postedAt",
                    "skills"}.issubset(doc.keys())

    @pytest.mark.asyncio
    async def test_get_opportunities_raises_on_error(self, mocker):
        given_in_memory_opportunity_data_db = Mock()
        collection_name = "opportunity_data"
        repo = OpportunitiesDataRepository(given_in_memory_opportunity_data_db, collection_name)

        class _GivenException(Exception):
            pass

        given_exception = _GivenException("Collection error")
        mocker.patch.object(repo._collection, "find", side_effect=given_exception)

        with pytest.raises(_GivenException):
            await repo.get_opportunities(limit=10, batch_size=5)
