import logging
from typing import Optional
from unittest.mock import Mock

import pytest

from app.agent.collect_experiences_agent._dataextraction_llm import _CollectedDataWithReasoning
from app.agent.collect_experiences_agent._types import CollectedData
from app.agent.collect_experiences_agent.data_extraction_llm import OperationsProcessor
from app.agent.collect_experiences_agent.data_extraction_llm._common import DataOperation
from app.agent.experience import WorkType


def _create_collected_data(
        index: int,
        experience_title: str,
        company: Optional[str] = None,
        
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        paid_work: Optional[bool] = None,
        work_type: Optional[str] = None,
        defined_at_turn_number: int = 1
) -> CollectedData:
    """Helper function to create CollectedData instances."""
    return CollectedData(
        uuid=f"test-uuid-{index}",
        index=index,
        defined_at_turn_number=defined_at_turn_number,
        experience_title=experience_title,
        company=company,
        # location=location,
        start_date=start_date,
        end_date=end_date,
        paid_work=paid_work,
        work_type=work_type or WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name
    )


def create_experience_data(
        data_operation: str,
        index: int,
        experience_title: Optional[str] = None,
        company: Optional[str] = None,
        
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        paid_work: Optional[bool] = None,
        work_type: Optional[str] = None
) -> _CollectedDataWithReasoning:
    """Helper function to create _CollectedDataWithReasoning objects."""
    return _CollectedDataWithReasoning(
        uuid=f"test-uuid-{index}",
        index=index,
        defined_at_turn_number=1,
        experience_title=experience_title,
        company=company,
        # location=location,
        start_date=start_date,
        end_date=end_date,
        paid_work=paid_work,
        work_type=work_type or WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name,
        data_operation=data_operation,
        data_extraction_references="",
        dates_mentioned="",
        dates_calculations="",
        work_type_classification_reasoning="",
        data_operation_reasoning=""
    )


class TestExperienceDataProcessor:
    """Test suite for ExperienceDataProcessor class."""

    @pytest.fixture
    def mock_logger(self):
        """Create a mock logger for testing."""
        logger = Mock(spec=logging.Logger)
        return logger

    @pytest.fixture
    def processor(self, mock_logger):
        """Create an ExperienceDataProcessor instance with mocked logger."""
        return OperationsProcessor(mock_logger)

    # ADD operation tests
    def test_add_single_new_experience(self, processor, mock_logger):
        """Should add a single new experience to empty collected data."""
        # GIVEN empty collected data
        given_collected_data = []

        # AND a new experience to add
        given_experiences_data = [
            create_experience_data(
                data_operation="ADD",
                index=0,  # Will be reassigned to 0
                experience_title="Software Developer",
                company="TechCorp",
                #location="Cape Town",
                start_date="2020",
                end_date="2022",
                paid_work=True,
                work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name
            )
        ]

        # AND current turn index
        given_current_turn_index = 2

        # WHEN processing the experience operations
        actual_last_processed_index, actual_collected_data = processor.process(
            given_experiences_data, given_collected_data, given_current_turn_index
        )

        # THEN the last processed index should be -1 (ADD operations don't set this)
        assert actual_last_processed_index == -1

        # AND the collected data should contain one experience
        assert len(actual_collected_data) == 1

        # AND the experience should have correct data
        experience = actual_collected_data[0]
        assert experience.index == 0
        assert experience.experience_title == "Software Developer"
        assert experience.company == "TechCorp"
        # assert experience.location == "Cape Town"
        assert experience.start_date == "2020"
        assert experience.end_date == "2022"
        assert experience.paid_work is True
        assert experience.work_type == WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name
        assert experience.defined_at_turn_number == 2

        # AND should log the addition
        mock_logger.info.assert_any_call("Adding new experience with index: %s", 0)

    def test_add_multiple_new_experiences(self, processor, mock_logger):
        """Should add multiple new experiences to existing collected data."""
        # GIVEN existing collected data with one experience
        given_collected_data = [
            _create_collected_data(
                index=0,
                experience_title="Software Developer",
                company="TechCorp",
                #location="Cape Town"
            )
        ]

        # AND two new experiences to add
        given_experiences_data = [
            create_experience_data(
                data_operation="ADD",
                index=1,  # Will be reassigned to 1
                experience_title="Freelance Designer",
                company="Self",
                # location="Johannesburg",
                work_type=WorkType.SELF_EMPLOYMENT.name
            ),
            create_experience_data(
                data_operation="ADD",
                index=2,  # Will be reassigned to 2
                experience_title="Volunteer",
                company="Animal Shelter",
                # location="Durban",
                work_type=WorkType.UNSEEN_UNPAID.name
            )
        ]

        # AND current turn index
        given_current_turn_index = 3

        # WHEN processing the experience operations
        actual_last_processed_index, actual_collected_data = processor.process(
            given_experiences_data, given_collected_data, given_current_turn_index
        )

        # THEN the last processed index should be -1 (ADD operations don't set this)
        assert actual_last_processed_index == -1

        # AND the collected data should contain three experiences
        assert len(actual_collected_data) == 3

        # AND the new experiences should be added with correct indices
        assert actual_collected_data[1].index == 1
        assert actual_collected_data[1].experience_title == "Freelance Designer"
        assert actual_collected_data[2].index == 2
        assert actual_collected_data[2].experience_title == "Volunteer"

        # AND should log both additions
        mock_logger.info.assert_any_call("Adding new experience with index: %s", 1)
        mock_logger.info.assert_any_call("Adding new experience with index: %s", 2)

    # UPDATE operation tests
    def test_update_existing_experience(self, processor, mock_logger):
        """Should update an existing experience with new data."""
        # GIVEN existing collected data
        given_collected_data = [
            _create_collected_data(
                index=0,
                experience_title="Software Developer",
                company=None,  # Missing company
                # location=None,  # Missing location
                start_date="2020",
                end_date="2022"
            )
        ]

        # AND an update operation for the existing experience
        given_experiences_data = [
            create_experience_data(
                data_operation="UPDATE",
                index=0,
                experience_title="Software Developer",  # Same title
                company="TechCorp",  # Adding company
                # location="Cape Town",  # Adding location
                start_date="2020",
                end_date="2022"
            )
        ]

        # AND current turn index
        given_current_turn_index = 2

        # WHEN processing the experience operations
        actual_last_processed_index, actual_collected_data = processor.process(
            given_experiences_data, given_collected_data, given_current_turn_index
        )

        # THEN the last processed index should be 0
        assert actual_last_processed_index == 0

        # AND the collected data should still contain one experience
        assert len(actual_collected_data) == 1

        # AND the experience should be updated with new data
        experience = actual_collected_data[0]
        assert experience.index == 0
        assert experience.company == "TechCorp"
        # assert experience.location == "Cape Town"

        # AND should log the update
        mock_logger.info.assert_any_call("Updating experience with index: %s", 0)

    def test_update_partial_fields(self, processor, mock_logger):
        """Should update only the provided fields, leaving others unchanged."""
        # GIVEN existing collected data
        given_collected_data = [
            _create_collected_data(
                index=0,
                experience_title="Software Developer",
                company="TechCorp",
          #      location="Cape Town",
                start_date="2020",
                end_date="2022",
                paid_work=True
            )
        ]

        # AND an update operation with only some fields
        given_experiences_data = [
            create_experience_data(
                data_operation="UPDATE",
                index=0,
                experience_title="Senior Software Developer",  # Only updating title
                company=None,  # Not updating company
           #     location=None,  # Not updating location
                start_date=None,  # Not updating start_date
                end_date=None,  # Not updating end_date
                paid_work=None  # Not updating paid_work
            )
        ]

        # AND current turn index
        given_current_turn_index = 2

        # WHEN processing the experience operations
        actual_last_processed_index, actual_collected_data = processor.process(
            given_experiences_data, given_collected_data, given_current_turn_index
        )

        # THEN the experience should have updated title but unchanged other fields
        experience = actual_collected_data[0]
        assert experience.experience_title == "Senior Software Developer"
        assert experience.company == "TechCorp"  # Unchanged
        # assert experience.location == "Cape Town"  # Unchanged
        assert experience.start_date == "2020"  # Unchanged
        assert experience.end_date == "2022"  # Unchanged
        assert experience.paid_work is True  # Unchanged

    def test_update_invalid_index(self, processor, mock_logger):
        """Should handle update with invalid index gracefully."""
        # GIVEN existing collected data with one experience
        given_collected_data = [
            _create_collected_data(
                index=0,
                experience_title="Software Developer"
            )
        ]

        # AND an update operation with invalid index
        given_experiences_data = [
            create_experience_data(
                data_operation="UPDATE",
                index=5,  # Invalid index
                experience_title="Updated Title"
            )
        ]

        # AND current turn index
        given_current_turn_index = 2

        # WHEN processing the experience operations
        actual_last_processed_index, actual_collected_data = processor.process(
            given_experiences_data, given_collected_data, given_current_turn_index
        )

        # THEN the last processed index should be -1 (no valid updates)
        assert actual_last_processed_index == -1

        # AND the collected data should be unchanged
        assert len(actual_collected_data) == 1
        assert actual_collected_data[0].experience_title == "Software Developer"

        # AND should log the error
        mock_logger.warn.assert_any_call("Invalid index:%s for updating experience", 5)

    # DELETE operation tests
    def test_delete_existing_experience(self, processor, mock_logger):
        """Should delete an existing experience."""
        # GIVEN existing collected data with multiple experiences
        given_collected_data = [
            _create_collected_data(index=0, experience_title="Software Developer"),
            _create_collected_data(index=1, experience_title="Freelance Designer"),
            _create_collected_data(index=2, experience_title="Volunteer")
        ]

        # AND a delete operation for the middle experience
        given_experiences_data = [
            create_experience_data(
                data_operation="DELETE",
                index=1  # Delete the second experience
            )
        ]

        # AND current turn index
        given_current_turn_index = 2

        # WHEN processing the experience operations
        actual_last_processed_index, actual_collected_data = processor.process(
            given_experiences_data, given_collected_data, given_current_turn_index
        )

        # THEN the last processed index should be -1 (no updates, only deletes)
        assert actual_last_processed_index == -1

        # AND the collected data should contain two experiences
        assert len(actual_collected_data) == 2

        # AND the deleted experience should be removed
        assert actual_collected_data[0].experience_title == "Software Developer"
        assert actual_collected_data[1].experience_title == "Volunteer"

        # AND should log the deletion
        mock_logger.info.assert_any_call("Deleting experience with index:%s", 1)

    def test_delete_multiple_experiences(self, processor, mock_logger):
        """Should delete multiple experiences."""
        # GIVEN existing collected data with multiple experiences
        given_collected_data = [
            _create_collected_data(index=0, experience_title="Software Developer"),
            _create_collected_data(index=1, experience_title="Freelance Designer"),
            _create_collected_data(index=2, experience_title="Volunteer"),
            _create_collected_data(index=3, experience_title="Intern")
        ]

        # AND delete operations for multiple experiences
        given_experiences_data = [
            create_experience_data(data_operation="DELETE", index=1),
            create_experience_data(data_operation="DELETE", index=3)
        ]

        # AND current turn index
        given_current_turn_index = 2

        # WHEN processing the experience operations
        actual_last_processed_index, actual_collected_data = processor.process(
            given_experiences_data, given_collected_data, given_current_turn_index
        )

        # THEN the collected data should contain two experiences
        assert len(actual_collected_data) == 2

        # AND the remaining experiences should be correct
        assert actual_collected_data[0].experience_title == "Software Developer"
        assert actual_collected_data[1].experience_title == "Volunteer"

        # AND should log both deletions
        mock_logger.info.assert_any_call("Deleting experience with index:%s", 1)
        mock_logger.info.assert_any_call("Deleting experience with index:%s", 3)

    def test_delete_invalid_index(self, processor, mock_logger):
        """Should handle delete with invalid index gracefully."""
        # GIVEN existing collected data
        given_collected_data = [
            _create_collected_data(index=0, experience_title="Software Developer")
        ]

        # AND a delete operation with invalid index
        given_experiences_data = [
            create_experience_data(data_operation="DELETE", index=5)
        ]

        # AND current turn index
        given_current_turn_index = 2

        # WHEN processing the experience operations
        actual_last_processed_index, actual_collected_data = processor.process(
            given_experiences_data, given_collected_data, given_current_turn_index
        )

        # THEN the collected data should be unchanged
        assert len(actual_collected_data) == 1
        assert actual_collected_data[0].experience_title == "Software Developer"

        # AND should log the error
        mock_logger.warn.assert_any_call("Invalid index:%s for deleting experience", 5)

    # Mixed operations tests
    def test_mixed_add_update_delete_operations(self, processor, mock_logger):
        """Should handle mixed ADD, UPDATE, and DELETE operations correctly."""
        # GIVEN existing collected data
        given_collected_data = [
            _create_collected_data(index=0, experience_title="Software Developer"),
            _create_collected_data(index=1, experience_title="Freelance Designer"),
            _create_collected_data(index=2, experience_title="Volunteer")
        ]

        # AND mixed operations
        given_experiences_data = [
            create_experience_data(data_operation="UPDATE", index=0, experience_title="Senior Software Developer"),
            create_experience_data(data_operation="DELETE", index=1),
            create_experience_data(
                data_operation="ADD",
                index=3,  # Will be reassigned to 2
                experience_title="Intern",
                work_type=WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK.name
            )
        ]

        # AND current turn index
        given_current_turn_index = 3

        # WHEN processing the experience operations
        actual_last_processed_index, actual_collected_data = processor.process(
            given_experiences_data, given_collected_data, given_current_turn_index
        )

        # THEN the last processed index should be 0 (from the update)
        assert actual_last_processed_index == 0

        # AND the collected data should contain three experiences
        assert len(actual_collected_data) == 3

        # AND the operations should be applied correctly
        assert actual_collected_data[0].experience_title == "Senior Software Developer"  # Updated
        assert actual_collected_data[1].experience_title == "Volunteer"  # Remaining
        assert actual_collected_data[2].experience_title == "Intern"  # Added

    # Edge cases and error handling
    def test_noop_operation(self, processor, mock_logger):
        """Should handle NOOP operations correctly."""
        # GIVEN existing collected data
        given_collected_data = [
            _create_collected_data(index=0, experience_title="Software Developer")
        ]

        # AND a NOOP operation
        given_experiences_data = [
            create_experience_data(data_operation="NOOP", index=0, experience_title="Software Developer")
        ]

        # AND current turn index
        given_current_turn_index = 2

        # WHEN processing the experience operations
        actual_last_processed_index, actual_collected_data = processor.process(
            given_experiences_data, given_collected_data, given_current_turn_index
        )

        # THEN the last processed index should be -1 (no operations)
        assert actual_last_processed_index == -1

        # AND the collected data should be unchanged
        assert len(actual_collected_data) == 1
        assert actual_collected_data[0].experience_title == "Software Developer"

        # AND should log the noop
        mock_logger.info.assert_any_call("No operation to be performed on experience: %s", "Software Developer")

    def test_invalid_operation(self, processor, mock_logger):
        """Should handle invalid operations gracefully."""
        # GIVEN existing collected data
        given_collected_data = [
            _create_collected_data(index=0, experience_title="Software Developer")
        ]

        # AND an invalid operation
        given_experiences_data = [
            create_experience_data(data_operation="INVALID", index=0, experience_title="Software Developer")
        ]

        # AND current turn index
        given_current_turn_index = 2

        # WHEN processing the experience operations
        actual_last_processed_index, actual_collected_data = processor.process(
            given_experiences_data, given_collected_data, given_current_turn_index
        )

        # THEN the last processed index should be -1 (no valid operations)
        assert actual_last_processed_index == -1

        # AND the collected data should be unchanged
        assert len(actual_collected_data) == 1

        # AND should log the error
        mock_logger.error.assert_any_call("Invalid data operation: %s", "INVALID")

    def test_empty_experiences_data(self, processor, mock_logger):
        """Should handle empty experiences data correctly."""
        # GIVEN existing collected data
        given_collected_data = [
            _create_collected_data(index=0, experience_title="Software Developer")
        ]

        # AND empty experiences data
        given_experiences_data = []

        # AND current turn index
        given_current_turn_index = 2

        # WHEN processing the experience operations
        actual_last_processed_index, actual_collected_data = processor.process(
            given_experiences_data, given_collected_data, given_current_turn_index
        )

        # THEN the last processed index should be -1 (no operations)
        assert actual_last_processed_index == -1

        # AND the collected data should be unchanged
        assert len(actual_collected_data) == 1
        assert actual_collected_data[0].experience_title == "Software Developer"

    def test_update_creates_duplicate(self, processor, mock_logger):
        """Should handle updates that create duplicates by removing the updated item."""
        # GIVEN existing collected data with two experiences
        given_collected_data = [
            _create_collected_data(index=0, experience_title="Software Developer", company="TechCorp",
                                   # location="Cape Town", 
                                   start_date="2020", end_date="2022"),
            _create_collected_data(index=1, experience_title="Freelance Designer", company="Self")
        ]

        # AND an update that would create a duplicate
        given_experiences_data = [
            create_experience_data(
                data_operation="UPDATE",
                index=1,
                experience_title="Software Developer",  # Same as index 0
                company="TechCorp",  # Same as index 0
                # location="Cape Town",  # Same as index 0
                start_date="2020",  # Same as index 0
                end_date="2022"  # Same as index 0
            )
        ]

        # AND current turn index
        given_current_turn_index = 2

        # WHEN processing the experience operations
        actual_last_processed_index, actual_collected_data = processor.process(
            given_experiences_data, given_collected_data, given_current_turn_index
        )

        # THEN the last processed index should be 0 (the kept duplicate)
        assert actual_last_processed_index == 0

        # AND the collected data should contain only one experience (duplicate removed)
        assert len(actual_collected_data) == 1
        assert actual_collected_data[0].experience_title == "Software Developer"
        assert actual_collected_data[0].company == "TechCorp"

        # AND should log the duplicate removal
        mock_logger.warning.assert_any_call("Updated experience duplicates an existing one; removing updated: %s",
                                            mock_logger.warning.call_args[0][1])

    def test_update_creates_empty_experience(self, processor, mock_logger):
        """Should handle updates that create empty experiences by removing them."""
        # GIVEN existing collected data
        given_collected_data = [
            _create_collected_data(index=0, experience_title="Software Developer", company="TechCorp")
        ]

        # AND an update that would create an empty experience
        given_experiences_data = [
            create_experience_data(
                data_operation="UPDATE",
                index=0,
                experience_title="",  # Empty title
                company="",  # Empty company
                # location="",  # Empty location
                start_date="",  # Empty start date
                end_date=""  # Empty end date
            )
        ]

        # AND current turn index
        given_current_turn_index = 2

        # WHEN processing the experience operations
        actual_last_processed_index, actual_collected_data = processor.process(
            given_experiences_data, given_collected_data, given_current_turn_index
        )

        # THEN the last processed index should be -1 (item was removed)
        assert actual_last_processed_index == -1

        # AND the collected data should be empty
        assert len(actual_collected_data) == 0

        # AND should log the empty experience removal
        mock_logger.warning.assert_any_call("Updated experience became empty and will be removed: %s",
                                            mock_logger.warning.call_args[0][1])


class TestDataOperation:
    """Test suite for _DataOperation class."""

    def test_from_string_key_valid_operations(self):
        """Should return correct operation for valid string keys."""
        # GIVEN valid operation strings
        # WHEN converting to operation
        # THEN should return correct operations
        assert DataOperation.from_string_key("ADD").value == "ADD"
        assert DataOperation.from_string_key("UPDATE").value == "UPDATE"
        assert DataOperation.from_string_key("DELETE").value == "DELETE"
        assert DataOperation.from_string_key("NOOP").value == "NOOP"

    def test_from_string_key_case_insensitive(self):
        """Should handle case insensitive operations."""
        # GIVEN mixed case operation strings
        # WHEN converting to operation
        # THEN should return correct operations
        assert DataOperation.from_string_key("add").value == "ADD"
        assert DataOperation.from_string_key("Update").value == "UPDATE"
        assert DataOperation.from_string_key("delete").value == "DELETE"
        assert DataOperation.from_string_key("noop").value == "NOOP"

    def test_from_string_key_invalid_operations(self):
        """Should return None for invalid operations."""
        # GIVEN invalid operation strings
        # WHEN converting to operation
        # THEN should return None
        assert DataOperation.from_string_key("INVALID") is None
        assert DataOperation.from_string_key("") is None
        assert DataOperation.from_string_key(None) is None
        assert DataOperation.from_string_key("MODIFY") is None
