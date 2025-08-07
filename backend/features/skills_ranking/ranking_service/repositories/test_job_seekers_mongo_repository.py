from unittest.mock import Mock

import pytest

from features.skills_ranking.ranking_service.repositories.job_seekers_mongo_repository import JobSeekersMongoRepository, \
    _from_db_document
from features.skills_ranking.ranking_service.types import JobSeeker


def _get_test_job_seeker():
    return JobSeeker(
        user_id="12345",
        skills_uuids={"skill-1", "skill-2"},
        opportunity_rank=0.75,
        compared_to_others_rank=0.8
    )

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
        assert job_seekers_ranks == expected_job_seekers_ranks \
 \
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
        given_job_seeker =JobSeeker(
            user_id="12345",
            external_user_id="ext-12345",
            opportunity_dataset_version="v1.0",
            skills_uuids={"skill-1", "skill-2", "skill-3"},
            taxonomy_model_id="taxonomy-1",
            opportunity_rank_prior_belief=0.1,
            opportunity_rank=0.85,
            compare_to_others_prior_belief=None,
            compared_to_others_rank=0.9
        )

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
        first_job_seeker_doc = await given_in_memory_job_seekers_db.get_collection(collection_name).find_one({"compassUserId": given_job_seeker.user_id})

        # AND the same jobseeker is saved again
        await job_seekers_data_repository.save_job_seeker_rank(given_job_seeker)
        second_job_seeker_doc = await given_in_memory_job_seekers_db.get_collection(collection_name).find_one({"compassUserId": given_job_seeker.user_id})


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
