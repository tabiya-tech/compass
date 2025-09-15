from datetime import datetime, timezone
from unittest.mock import Mock

import pytest
import pytest_mock
from bson import ObjectId

from common_libs.time_utilities import get_now, truncate_microseconds
from features.skills_ranking.ranking_service.repositories.job_seekers_mongo_repository import JobSeekersMongoRepository, \
    _from_db_document
from features.skills_ranking.ranking_service.types import JobSeeker, DatasetInfo, OpportunitiesInfo


def _get_test_job_seeker():
    return JobSeeker(
        id=ObjectId().__str__(),
        user_id="12345",
        external_user_id="ext-12345",
        skills_origin_uuids={"skill-origin-1", "skill-origin-2"},
        skill_groups_origin_uuids={"skill-group-origin-1", "skill-group-origin-2"},
        opportunity_rank_prior_belief=0.1,
        opportunity_rank=0.85,
        compare_to_others_prior_belief=None,
        compared_to_others_rank=0.9,
        opportunity_rank_history={truncate_microseconds(get_now()): 0.85},
        compared_to_others_rank_history={truncate_microseconds(get_now()): 0.9},
        dataset_info=DatasetInfo(
            taxonomy_model_id="model-123",
            matching_threshold=0.04,
            fetch_time=truncate_microseconds(get_now()),
            entities_used="skillGroups",
            input_opportunities=OpportunitiesInfo(
                total_count=10,
                hash="input-hash-123",
                hash_algo="md5"
            ),
            matching_opportunities=OpportunitiesInfo(
                total_count=5,
                hash="matching-hash-456",
                hash_algo="md5"
            )
        )
    )


def _get_different_versions_of_job_seekers_data() -> tuple[dict, dict, dict, dict]:
    # GIVEN a job seeker document with no dataset_info field (v0 schema)

    v0_job_seeker_doc = {
        "externalUserId": "1",
        "skillsUUIDs": ["skill-group-uuid-1"],
        "skillGroupsUUIDs": ["skill-uuid-1"],
        "comparedToOthersRank": 0.5,
        "compassUserId": "compass-user-id-0",
        "opportunityDatasetVersion": "v-0",
        "opportunityRank": 0.166,
        "createdAt": {"$date": "2025-08-21T11:11:23.247Z"},
        "updatedAt": {"$date": "2025-08-21T11:11:23.247Z"}
    }

    v1_job_seeker_doc = {
        "externalUserId": "1",
        "compassUserId": "compass-user-id-0",

        "opportunityRank": 0.166,
        "comparedToOthersRank": 0.5,

        "opportunityDatasetVersion": "v-0",
        "skillGroupsUUIDs": ["skill-uuid-1"],
        "skillsUUIDs": ["skill-group-uuid-1"],
        "createdAt": {"$date": "2025-08-21T11:11:23.247Z"},
        "updatedAt": {"$date": "2025-08-21T11:11:23.247Z"}
    }

    # AND a job seeker document with flat dataset_info field (v1 schema)
    v2_job_seeker_doc = {
        "comparedToOthersRank": 0.1,
        "createdAt": {"$date": "2025-08-29T10:53:56.167Z"},
        "externalUserId": "ext-user-v1-doc",
        "opportunityDatasetVersion": "version-2",
        "opportunityRank": 0.1,
        "skillGroupsUUIDs": ["skill-group-uuid-2"],
        "skillsUUIDs": ["skill-uuid-2"],
        "updatedAt": {"$date": "2021-08-29T10:53:56.167Z"},
        "compareToOthersPriorBelief": 0.1,
        "compassUserId": "compass-user-id-1",
        "opportunityRankPriorBelief": 0.1,
        "taxonomyModelId": "taxonomy-model-v1",
        "matchingThreshold": 0.05,
        "numberOfTotalOpportunities": 5,
        "opportunitiesLastFetchTime": {"$date": "2021-08-29T09:16:38.293Z"},
        "totalMatchingOpportunities": 2
    }

    # AND a job seeker document with latest schema data info (v2 schema)
    v3_job_seeker_doc = {
        'compassUserId': '12345',
        'externalUserId': 'ext-12345',
        'skillsOriginUUIDs': ['skill-origin-1', 'skill-origin-2'],
        'skillGroupsOriginUUIDs': ['skill-group-origin-1', 'skill-group-origin-2'],

        'opportunityRankPriorBelief': 0.1,
        'opportunityRank': 0.85,

        'compareToOthersPriorBelief': 0.3,
        'comparedToOthersRank': 0.9,
        'datasetInfo': {
            'taxonomyModelId': 'model-123',
            'entitiesUsed': 'skillGroups',
            'matchingThreshold': 0.04,
            'inputOpportunities': {
                'totalCount': 10,
                'hash': 'input-hash-123',
                "hashAlgo": 'md5'
            },
            'matchingOpportunities': {
                'totalCount': 5,
                'hash': 'matching-hash-456',
                "hashAlgo": 'md5'
            },
            'fetchTime': datetime(2025, 9, 3, 16, 16, 27, 7000, tzinfo=timezone.utc)},
        'opportunityRankHistory': {
            '2025-09-03 16:16:27.007000+00:00': 0.2
        },
        'comparedToOthersRankHistory': {
            '2025-09-03 16:16:27.007000+00:00': 0.1
        },
        'updatedAt': datetime(2025, 9, 3, 16, 16, 27, 7311, tzinfo=timezone.utc)
    }

    return v0_job_seeker_doc, v1_job_seeker_doc, v2_job_seeker_doc, v3_job_seeker_doc


class TestGetJobSeekersRanks:
    @pytest.mark.asyncio
    async def test_get_job_seekers_ranks_success(self, in_memory_job_seekers_db, caplog):
        # GIVEN some test jobseekers ranks.
        given_job_seekers_ranks = [
            {"opportunityRank": 1.0},
            {"opportunityRank": 0.5},
            {"opportunityRank": 0.75},
            {"opportunityRank": 0.25},
            {"opportunityRank": 0.9},
            {"opportunityRank": 0.8},
            {}  # This should be skipped as it has no rank
        ]

        # AND the given jobseekers data is inserted into the in-memory database
        given_in_memory_job_seekers_db = in_memory_job_seekers_db
        collection_name = "job_seekers_data"
        await given_in_memory_job_seekers_db.get_collection(collection_name).insert_many(given_job_seekers_ranks)

        # AND the jobseeker data repository is created
        job_seekers_data_repository = JobSeekersMongoRepository(given_in_memory_job_seekers_db, collection_name)

        # WHEN the repository.get_job_seekers_ranks is called with the given params
        job_seekers_ranks = await job_seekers_data_repository.get_job_seekers_ranks(2)

        # THEN the jobseeker ranks are returned as expected.
        # AND some expected jobseeker ranks excluding the one with no rank.
        expected_job_seekers_ranks = [doc.get("opportunityRank") for doc in given_job_seekers_ranks if
                                      doc.get("opportunityRank") is not None]
        assert job_seekers_ranks == expected_job_seekers_ranks
        # AND an error should be logged because we have a document with no rank
        assert "Found job seeker with missing or invalid rank" in caplog.text

    @pytest.mark.asyncio
    async def test_get_job_seekers_ranks_an_error(self, mocker):
        # GIVEN an instance of JobSeekersMongo Database
        given_in_memory_job_seekers_db = Mock()

        # AND given the collection name is 'opportunity_data'
        collection_name = "job_seekers_data"

        # AND the opportunity data repository is created
        job_seekers_data_repository = JobSeekersMongoRepository(given_in_memory_job_seekers_db, collection_name)

        class _GivenException(Exception):
            pass

        given_exception = _GivenException("Collection error")
        mocker.patch.object(job_seekers_data_repository._collection, "find", side_effect=given_exception)

        # WHEN the repository.get_opportunities_skills_uuids is called with the given params
        with pytest.raises(_GivenException):
            await job_seekers_data_repository.get_job_seekers_ranks(10)

    @pytest.mark.asyncio
    async def test_no_job_seekers_found(self, in_memory_job_seekers_db, caplog):
        # GIVEN an empty in-memory jobseekers database
        given_in_memory_job_seekers_db = in_memory_job_seekers_db
        collection_name = "job_seekers_data"

        # AND the jobseeker data repository is created
        job_seekers_data_repository = JobSeekersMongoRepository(given_in_memory_job_seekers_db, collection_name)

        # WHEN the repository.get_job_seekers_ranks is called with the given params
        job_seekers_ranks = await job_seekers_data_repository.get_job_seekers_ranks(10)

        # THEN no jobseeker ranks are returned
        assert job_seekers_ranks == []

        # AND an error should be logged indicating no jobseeker ranks were found
        assert "No job seeker ranks found in the database." in caplog.text

    @pytest.mark.asyncio
    async def test_should_handle_different_versions_of_job_seekers(self, in_memory_job_seekers_db):
        # GIVEN three job seekers documents with different schema versions (v0, v1, v2)
        v0_job_seeker_doc, v1_job_seeker_doc, v2_job_seeker_doc, v3_job_seeker_doc = _get_different_versions_of_job_seekers_data()

        # AND all the job seekers documents are in the db
        given_in_memory_job_seekers_db = in_memory_job_seekers_db
        collection_name = "job_seekers_data"
        await given_in_memory_job_seekers_db.get_collection(collection_name).insert_many([
            v0_job_seeker_doc,
            v1_job_seeker_doc,
            v2_job_seeker_doc,
            v3_job_seeker_doc
        ])

        # WHEN we query the job seeker's rank from the database
        job_seekers_data_repository = JobSeekersMongoRepository(given_in_memory_job_seekers_db, collection_name)
        job_seekers_ranks = await job_seekers_data_repository.get_job_seekers_ranks(10)

        # THEN it should return the actual ranks without errors
        assert job_seekers_ranks == [0.166, 0.166, 0.1, 0.85]


class TestSaveJobSeekerRank:
    @pytest.mark.asyncio
    async def test_save_job_seeker_rank_success(self, in_memory_job_seekers_db):
        # GIVEN an instance of JobSeekersMongo Database
        given_in_memory_job_seekers_db = in_memory_job_seekers_db

        # AND the collection name is 'job_seekers_data'
        collection_name = "job_seekers_data"

        # AND the jobseeker data repository is created
        job_seekers_data_repository = JobSeekersMongoRepository(given_in_memory_job_seekers_db, collection_name)

        # AND a jobseeker with a rank to be saved
        given_job_seeker = _get_test_job_seeker()

        # WHEN the repository.save_job_seeker_rank is called with the given params
        await job_seekers_data_repository.save_job_seeker_rank(given_job_seeker)

        # THEN the jobseeker rank is saved successfully in the database
        saved_job_seeker = await given_in_memory_job_seekers_db.get_collection(collection_name).find_one(
            {"compassUserId": given_job_seeker.user_id}
        )

        # THEN the saved jobseeker should not be None and should match the given jobseeker
        typed_saved_job_seeker = _from_db_document(saved_job_seeker)
        assert typed_saved_job_seeker.model_dump() == given_job_seeker.model_dump()

        # AND the saved jobseeker should have the timestamp fields, and they should match the given time
        assert "updatedAt" in saved_job_seeker
        assert "createdAt" in saved_job_seeker

    @pytest.mark.asyncio
    async def test_save_job_seeker_rank_success_only_required_fields(self, in_memory_job_seekers_db):
        # GIVEN an instance of JobSeekersMongo Database
        given_in_memory_job_seekers_db = in_memory_job_seekers_db

        # AND the collection name is 'job_seekers_data'
        collection_name = "job_seekers_data"

        # AND the jobseeker data repository is created
        job_seekers_data_repository = JobSeekersMongoRepository(given_in_memory_job_seekers_db, collection_name)

        # AND a jobseeker with only required fields to be saved
        given_job_seeker = _get_test_job_seeker()

        # WHEN the repository.save_job_seeker_rank is called with the given params
        await job_seekers_data_repository.save_job_seeker_rank(given_job_seeker)

        # THEN the jobseeker rank is saved successfully in the database
        saved_job_seeker = await given_in_memory_job_seekers_db.get_collection(collection_name).find_one(
            {"compassUserId": given_job_seeker.user_id}
        )

        # THEN the saved jobseeker should not be None and should match the given jobseeker
        typed_saved_job_seeker = _from_db_document(saved_job_seeker)
        assert typed_saved_job_seeker.model_dump() == given_job_seeker.model_dump()

    @pytest.mark.asyncio
    async def test_save_job_seeker_rank_success_document_already_exists(self, in_memory_job_seekers_db, caplog):
        # GIVEN an instance of JobSeekersMongo Database
        given_in_memory_job_seekers_db = in_memory_job_seekers_db

        # AND the collection name is 'job_seekers_data'
        collection_name = "job_seekers_data"

        # AND the jobseeker data repository is created
        job_seekers_data_repository = JobSeekersMongoRepository(given_in_memory_job_seekers_db, collection_name)

        # AND a jobseeker with a rank to be saved
        given_job_seeker = _get_test_job_seeker()

        # WHEN the repository.save_job_seeker_rank is called with the given params
        await job_seekers_data_repository.save_job_seeker_rank(given_job_seeker)
        first_job_seeker_doc = await given_in_memory_job_seekers_db.get_collection(collection_name).find_one(
            {"compassUserId": given_job_seeker.user_id})

        # AND the same jobseeker is saved again
        await job_seekers_data_repository.save_job_seeker_rank(given_job_seeker)
        second_job_seeker_doc = await given_in_memory_job_seekers_db.get_collection(collection_name).find_one(
            {"compassUserId": given_job_seeker.user_id})

        # THEN the jobseeker rank is saved successfully in the database without duplication
        saved_job_seekers = await given_in_memory_job_seekers_db.get_collection(collection_name).find(
            {"compassUserId": given_job_seeker.user_id}
        ).to_list(None)
        assert len(saved_job_seekers) == 1

        # AND saved jobseeker should not be None and should match the given jobseeker
        typed_saved_job_seeker = _from_db_document(second_job_seeker_doc)
        assert typed_saved_job_seeker.model_dump() == given_job_seeker.model_dump()

        # AND the first and second saved jobseekers should be the same
        assert _from_db_document(first_job_seeker_doc) == _from_db_document(second_job_seeker_doc)

        # AND an error should be logged indicating the jobseeker already exists
        assert f"Job seeker {given_job_seeker.user_id} already exists in the database. Updating their rank." in caplog.text

        # AND the createdAt for second saved jobseeker should be the same as the first one
        assert first_job_seeker_doc["createdAt"] == second_job_seeker_doc["createdAt"]

        # AND the updatedAt for second saved jobseeker should be different from the first one
        assert first_job_seeker_doc["updatedAt"] != second_job_seeker_doc["updatedAt"]

    @pytest.mark.asyncio
    async def test_save_job_seeker_rank_success_document_already_exists_histories(self, in_memory_job_seekers_db,
                                                                                  caplog):
        # GIVEN an instance of JobSeekersMongo Database
        given_in_memory_job_seekers_db = in_memory_job_seekers_db

        # AND the collection name is 'job_seekers_data'
        collection_name = "job_seekers_data"

        # AND the jobseeker data repository is created
        job_seekers_data_repository = JobSeekersMongoRepository(given_in_memory_job_seekers_db, collection_name)

        # AND a jobseeker with a rank to be saved
        given_job_seeker = _get_test_job_seeker()

        # WHEN the repository.save_job_seeker_rank is called with the given params
        await job_seekers_data_repository.save_job_seeker_rank(given_job_seeker)
        first_job_seeker_doc = await given_in_memory_job_seekers_db.get_collection(collection_name).find_one(
            {"compassUserId": given_job_seeker.user_id})

        # AND the same jobseeker is saved again with histories updated.
        given_job_seeker.opportunity_rank_history = {get_now(): 0.4}
        given_job_seeker.compared_to_others_rank_history = {get_now(): 0.3}
        await job_seekers_data_repository.save_job_seeker_rank(given_job_seeker)
        second_job_seeker_doc = await given_in_memory_job_seekers_db.get_collection(collection_name).find_one(
            {"compassUserId": given_job_seeker.user_id})

        # AND saved jobseeker should not be None and should match the given jobseeker
        assert _from_db_document(first_job_seeker_doc) != _from_db_document(second_job_seeker_doc)

        # AND the histories should be merged
        _formatted_doc = _from_db_document(second_job_seeker_doc)
        assert len(_formatted_doc.opportunity_rank_history.items()) == 2
        assert len(_formatted_doc.compared_to_others_rank_history.items()) == 2

    @pytest.mark.asyncio
    async def test_save_job_seeker_rank_db_throws_an_error(self, in_memory_job_seekers_db, mocker):
        # GIVEN an instance of JobSeekersMongo Database
        given_in_memory_job_seekers_db = in_memory_job_seekers_db

        # AND the collection name is 'job_seekers_data'
        collection_name = "job_seekers_data"

        # AND the jobseeker data repository is created
        job_seekers_data_repository = JobSeekersMongoRepository(given_in_memory_job_seekers_db, collection_name)

        # AND a jobseeker with a rank to be saved
        given_job_seeker = _get_test_job_seeker()

        # AND the collection is mocked to throw an error when saving
        class _GivenException(Exception):
            pass

        given_exception = _GivenException("Collection error")
        mocker.patch.object(job_seekers_data_repository._collection, "update_one", side_effect=given_exception)

        # WHEN the repository.save_job_seeker_rank is called with the given params
        with pytest.raises(_GivenException):
            await job_seekers_data_repository.save_job_seeker_rank(given_job_seeker)


class TestStreamJobSeekers:
    @pytest.mark.asyncio
    async def test_stream_job_seekers_success(self, in_memory_job_seekers_db):
        # GIVEN a random `job seeker`.
        given_job_seeker = _get_test_job_seeker()

        # AND the given jobseekers data is inserted into the in-memory database
        collection_name = "job_seekers_data"
        job_seeker_repository = JobSeekersMongoRepository(in_memory_job_seekers_db, collection_name)
        await job_seeker_repository.save_job_seeker_rank(given_job_seeker)

        # WHEN the stream method is called
        actual_iterator = job_seeker_repository.stream(batch_size=10)

        # THEN a valid `actual_iterator` is returned
        assert actual_iterator is not None

        # AND the `actual_iterator` can be iterated
        actual_entities = []
        async for item in actual_iterator:
            actual_entities.append(item)

        # AND the retrieved `jobseekers` should be the same as the ones inserted.
        assert len(actual_entities) == 1
        assert actual_entities[0] == given_job_seeker

    @pytest.mark.asyncio
    async def test_stream_throws_an_error(self, in_memory_job_seekers_db, mocker: pytest_mock.MockerFixture):
        # GIVEN a repository is initialized
        repository = JobSeekersMongoRepository(in_memory_job_seekers_db, "job_seekers_data")

        # AMD the repository's collection's find function throws a given exception
        class _GivenError(Exception):
            pass

        _database_stream_spy = mocker.spy(repository._collection, 'find')
        given_exception = _GivenError('given error message')
        _database_stream_spy.side_effect = given_exception

        # WHEN the stream method is called, and the returned iterator is iterated
        # THEN an exception should be raised
        with pytest.raises(_GivenError) as actual_error_info:
            actual_iterator = repository.stream(batch_size=10)
            async for _ in actual_iterator:
                pytest.fail("This should not be reached")

        # AND the raised error message should be the same as the given error
        assert actual_error_info.value == given_exception
