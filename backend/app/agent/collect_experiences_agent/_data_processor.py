"""
Data processing logic for experience data extraction and manipulation.

This module contains the complex logic for processing experience data operations
(ADD, UPDATE, DELETE) extracted from LLM responses. It handles index mapping,
duplicate detection, and maintains data consistency.
"""

import logging
from typing import Optional

from app.agent.collect_experiences_agent._types import CollectedData
from app.agent.experience.work_type import WorkType


class _DataOperation:
    """Enum-like class for data operations."""
    ADD = "ADD"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    NOOP = "NOOP"

    @staticmethod
    def from_string_key(operation: Optional[str]) -> Optional['_DataOperation']:
        """Convert string operation to enum value."""
        if not operation:
            return None
        operation_upper = operation.upper()
        if operation_upper in [_DataOperation.ADD, _DataOperation.UPDATE, _DataOperation.DELETE, _DataOperation.NOOP]:
            return operation_upper
        return None


class ExperienceDataProcessor:
    """
    Handles the complex logic for processing experience data operations.
    
    This class manages index mapping, duplicate detection, and maintains
    data consistency when applying ADD, UPDATE, and DELETE operations.
    """

    def __init__(self, logger: logging.Logger):
        self.logger = logger

    def process_experience_operations(self, 
                                    experiences_data: list,
                                    collected_experience_data_so_far: list[CollectedData],
                                    current_turn_index: int) -> tuple[int, list[CollectedData]]:
        """
        Process all experience data operations and return the last processed index and updated data.
        
        Args:
            experiences_data: List of experience data from LLM response
            collected_experience_data_so_far: Current collected experience data
            current_turn_index: Current turn index for new experiences
            
        Returns:
            Tuple of (last_processed_index, updated_collected_data)
        """
        # Create mapping from original LLM indexes to current list positions
        index_mapping = {i: i for i in range(len(collected_experience_data_so_far))}
        
        # Keep track of pending deletes and adds to apply them after the updates
        pending_delete_original_indexes: list[int] = []
        pending_add_payloads: list = []
        
        last_processed_index = -1
        
        # Process each experience in the array
        for _data in experiences_data:
            data_operation = _DataOperation.from_string_key(_data.data_operation)
            
            if data_operation is None or data_operation == _DataOperation.NOOP:
                if data_operation is None:
                    self.logger.error("Invalid data operation: %s", _data.data_operation)
                else:
                    self.logger.info("No operation to be performed on experience: %s", _data.experience_title)
                continue
            
            if data_operation == _DataOperation.UPDATE:
                last_processed_index = self._process_update_operation(
                    _data, collected_experience_data_so_far, index_mapping, pending_delete_original_indexes)
            elif data_operation == _DataOperation.DELETE:
                pending_delete_original_indexes.append(_data.index)
            elif data_operation == _DataOperation.ADD:
                pending_add_payloads.append(_data)
            else:
                self.logger.error("Invalid data operation: %s", _data.data_operation)
        
        # Apply pending deletes
        self._apply_pending_deletes(pending_delete_original_indexes, collected_experience_data_so_far, index_mapping)
        
        # Apply pending adds
        self._apply_pending_adds(pending_add_payloads, collected_experience_data_so_far, current_turn_index)
        
        return last_processed_index, collected_experience_data_so_far

    def _process_update_operation(self, _data, collected_experience_data_so_far: list[CollectedData], 
                                index_mapping: dict, pending_delete_original_indexes: list[int]) -> int:
        """Process an UPDATE operation."""
        current_index = index_mapping.get(_data.index, -1)
        if 0 <= current_index < len(collected_experience_data_so_far):
            to_update = collected_experience_data_so_far[current_index]
            before_update = to_update.model_dump()
            self.logger.info("Updating experience with index: %s", _data.index)
            
            # Update fields if they are not None
            if _data.experience_title is not None:
                to_update.experience_title = _data.experience_title
            if _data.paid_work is not None:
                to_update.paid_work = _data.paid_work
            if WorkType.from_string_key(_data.work_type) is not None:
                to_update.work_type = _data.work_type
            if _data.start_date is not None:
                to_update.start_date = _data.start_date
            if _data.end_date is not None:
                to_update.end_date = _data.end_date
            if _data.company is not None:
                to_update.company = _data.company
            if _data.location is not None:
                to_update.location = _data.location
            
            # Resolve empties/duplicates inline to keep indexes consistent
            if self._is_experience_empty(to_update):
                self.logger.warning("Updated experience became empty and will be removed: %s", to_update)
                pending_delete_original_indexes.append(_data.index)
                return -1
            else:
                duplicate_index = self._find_duplicate_index(
                    to_update, collected_experience_data_so_far, exclude_index=current_index)
                if duplicate_index >= 0:
                    kept_index = duplicate_index
                    self.logger.warning("Updated experience duplicates an existing one; removing updated: %s", to_update)
                    pending_delete_original_indexes.append(_data.index)
                    return kept_index
                else:
                    after_update = to_update.model_dump()
                    self.logger.info("Experience data with index:%s updated:\n  - diff:%s",
                                     _data.index, self._dict_diff(before_update, after_update))
                    return _data.index
        else:
            self.logger.error("Invalid index:%s for updating experience", _data.index)
            return -1

    def _apply_pending_deletes(self, pending_delete_original_indexes: list[int], 
                             collected_experience_data_so_far: list[CollectedData], 
                             index_mapping: dict):
        """Apply all pending delete operations."""
        for original_index in sorted(pending_delete_original_indexes):
            current_index = index_mapping.get(original_index, -1)
            if 0 <= current_index < len(collected_experience_data_so_far):
                self.logger.info("Deleting experience with index:%s", original_index)
                del collected_experience_data_so_far[current_index]
                self._update_index_mapping_after_deletion(index_mapping, current_index)
            else:
                self.logger.error("Invalid index:%s for deleting experience", original_index)

    def _apply_pending_adds(self, pending_add_payloads: list, 
                          collected_experience_data_so_far: list[CollectedData], 
                          current_turn_index: int):
        """Apply all pending add operations."""
        next_available_index = (
            max([existing_item.index for existing_item in collected_experience_data_so_far]) + 1
        ) if collected_experience_data_so_far else 0
        
        appended_add_count = 0
        for add_payload in pending_add_payloads:
            new_index = next_available_index + appended_add_count
            appended_add_count += 1
            self.logger.info("Adding new experience with index: %s", new_index)
            
            work_type = WorkType.from_string_key(add_payload.work_type)
            work_type = work_type.name if work_type is not None else None
            
            new_item = CollectedData(
                index=new_index,
                defined_at_turn_number=current_turn_index,
                experience_title=add_payload.experience_title,
                paid_work=add_payload.paid_work,
                work_type=work_type,
                start_date=add_payload.start_date,
                end_date=add_payload.end_date,
                company=add_payload.company,
                location=add_payload.location
            )
            collected_experience_data_so_far.append(new_item)

    @staticmethod
    def _is_experience_empty(experience: CollectedData) -> bool:
        """Check if an experience is empty (has no meaningful data)."""
        return (
            (experience.experience_title is None or experience.experience_title.strip() == "") and
            (experience.start_date is None or experience.start_date.strip() == "") and
            (experience.end_date is None or experience.end_date.strip() == "") and
            (experience.company is None or experience.company.strip() == "") and
            (experience.location is None or experience.location.strip() == "")
        )

    @staticmethod
    def _find_duplicate_index(item: CollectedData, items: list[CollectedData], 
                            exclude_index: int | None = None) -> int:
        """Find the index of a duplicate experience in the list."""
        for i, existing_item in enumerate(items):
            if exclude_index is not None and i == exclude_index:
                continue
            if (item.experience_title == existing_item.experience_title and
                item.start_date == existing_item.start_date and
                item.end_date == existing_item.end_date and
                item.company == existing_item.company and
                item.location == existing_item.location):
                return i
        return -1

    @staticmethod
    def _update_index_mapping_after_deletion(index_mapping: dict, deleted_index: int):
        """Update the index mapping after a deletion."""
        for original_index, current_index in index_mapping.items():
            if current_index > deleted_index:
                index_mapping[original_index] = current_index - 1

    @staticmethod
    def _dict_diff(old_dict: dict, new_dict: dict) -> list[str]:
        """Calculate the difference between two dictionaries."""
        diff = []
        all_keys = set(old_dict.keys()) | set(new_dict.keys())
        for key in all_keys:
            old_value = old_dict.get(key)
            new_value = new_dict.get(key)
            if old_value != new_value:
                diff.append(f"{key}: {old_value} -> {new_value}")
        return diff


