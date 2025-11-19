import pytest

from common_libs.test_utilities import get_random_user_id
from features.skills_ranking.state.repositories.errors import RegistrationDataNotFoundError
from features.skills_ranking.state.repositories.registration_mongo_repository import RegistrationMongoRepository


class TestGetPriorBeliefs:
    @pytest.mark.asyncio
    async def test_get_prior_beliefs_success(self, in_memory_registration_data_db):
        # GIVEN a brujula user id
        given_user_id = get_random_user_id()
        given_external_user_id = get_random_user_id()

        # AND given a collection name, and a document with all the fields
        given_collection_name = "registration_data"
        given_document = {
            "compassUserId": given_user_id,
            "externalUserId": given_external_user_id,
            "opportunityRankPriorBelief": 0.8,
            "compareToOthersPriorBelief": 0.5
        }

        # AND the document is inserted into the in-memory database
        await in_memory_registration_data_db[given_collection_name].insert_one(given_document)

        # AND a registration mongo repository is initialized with an in-memory database
        registration_mongo_repository = RegistrationMongoRepository(in_memory_registration_data_db,
                                                                    given_collection_name)

        # WHEN the get_prior_beliefs method is called with the user id
        prior_beliefs = await registration_mongo_repository.get_prior_beliefs(given_user_id)

        # THEN the returned PriorBeliefs object should match the expected values
        assert prior_beliefs.opportunity_rank_prior_belief == given_document["opportunityRankPriorBelief"]
        assert prior_beliefs.compare_to_others_prior_belief == given_document["compareToOthersPriorBelief"]
        assert prior_beliefs.external_user_id == given_external_user_id

    @pytest.mark.asyncio
    async def test_get_prior_beliefs_not_found(self, in_memory_registration_data_db):
        # GIVEN a brujula user id that does not exist in the database
        given_user_id = get_random_user_id()

        # AND a registration mongo repository initialized with an in-memory database
        registration_mongo_repository = RegistrationMongoRepository(in_memory_registration_data_db,
                                                                    "registration_data")

        # WHEN the get_prior_beliefs method is called with the user id
        # THEN it should raise RegistrationDataNotFoundError
        with pytest.raises(RegistrationDataNotFoundError):
            await registration_mongo_repository.get_prior_beliefs(given_user_id)

    @pytest.mark.asyncio
    async def test_get_prior_beliefs_opportunity_rank_prior_belief_not_in_doc(self, in_memory_registration_data_db):
        # GIVEN a brujula user id
        given_user_id = get_random_user_id()

        # AND a collection name, and a document without opportunityRankPriorBelief
        given_collection_name = "registration_data"
        given_document = {
            "compassUserId": given_user_id,
            "compareToOthersPriorBelief": 0.5
        }

        # AND the document is inserted into the in-memory database
        await in_memory_registration_data_db[given_collection_name].insert_one(given_document)

        # AND a registration mongo repository is initialized with an in-memory database
        registration_mongo_repository = RegistrationMongoRepository(in_memory_registration_data_db,
                                                                    given_collection_name)

        # WHEN the get_prior_beliefs method is called with the user id
        # THEN it should raise RegistrationDataNotFoundError
        with pytest.raises(RegistrationDataNotFoundError):
            await registration_mongo_repository.get_prior_beliefs(given_user_id)

    @pytest.mark.asyncio
    async def test_get_prior_beliefs_compare_to_others_prior_belief_not_in_doc(self, in_memory_registration_data_db, caplog):
        # GIVEN a brujula user id
        given_user_id = get_random_user_id()

        # AND a collection name, and a document without compareToOthersPriorBelief
        given_collection_name = "registration_data"
        given_document = {
            "compassUserId": given_user_id,
            "opportunityRankPriorBelief": 0.8
        }

        # AND the document is inserted into the in-memory database
        await in_memory_registration_data_db[given_collection_name].insert_one(given_document)

        # AND a registration mongo repository is initialized with an in-memory database
        registration_mongo_repository = RegistrationMongoRepository(in_memory_registration_data_db,
                                                                    given_collection_name)

        # WHEN the get_prior_beliefs method is called with the user id
        prior_beliefs = await registration_mongo_repository.get_prior_beliefs(given_user_id)

        # THEN the returned PriorBeliefs object should have compare_to_others_prior_belief set to 0.0
        assert prior_beliefs.opportunity_rank_prior_belief == given_document["opportunityRankPriorBelief"]
        assert prior_beliefs.compare_to_others_prior_belief == 0

        # AND a warning should be logged
        assert "compareToOthersPriorBelief not found in document, setting to default 0.0" in caplog.text

    @pytest.mark.asyncio
    async def test_get_prior_beliefs_database_error(self, in_memory_registration_data_db, mocker):
        # GIVEN a brujula user id
        given_user_id = get_random_user_id()

        # AND a collection name, and a document with all the fields
        given_collection_name = "registration_data"

        # AND a registration mongo repository initialized with an in-memory database
        registration_mongo_repository = RegistrationMongoRepository(in_memory_registration_data_db, given_collection_name)

        class _GivenException(Exception):
            pass

        # AND db.find one is mocked to raise an exception
        mocker.patch.object(
            registration_mongo_repository._collection,
            'find_one',
            side_effect=_GivenException("Database error")
        )

        # WHEN the get_prior_beliefs method is called with the user id.
        # THEN it should raise an exception (simulating a database error)
        with pytest.raises(_GivenException):
            await registration_mongo_repository.get_prior_beliefs(given_user_id)
