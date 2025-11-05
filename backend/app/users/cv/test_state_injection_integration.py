"""
Integration tests for CV upload with state injection.

These tests verify that the full pipeline works:
1. CV upload extracts session_id from user preferences
2. Structured extraction produces data
3. State injection populates all agent states correctly
4. State persists and can be retrieved
"""
import asyncio

import pytest
from unittest.mock import AsyncMock

from app.application_state import ApplicationState
from app.agent.collect_experiences_agent._types import CollectedData
from app.agent.experience.experience_entity import ExperienceEntity, ResponsibilitiesData
from app.agent.experience.timeline import Timeline
from app.agent.experience.work_type import WorkType
from app.users.cv.service import CVUploadService
from app.users.cv.types import CVStructuredExtraction, UploadProcessState, UserCVUpload
from app.users.cv.test_service import MockCVRepository, MockCVCloudStorageService


class InMemoryCVRepository(MockCVRepository):
    """In-memory repository that tracks injection status"""
    
    def __init__(self):
        super().__init__()
        self._uploads = {}
        self._injected_upload_ids = set()
        self._failed_injection_errors = {}
    
    async def insert_upload(self, upload: UserCVUpload) -> str:
        self._uploads[upload.upload_id] = upload
        return upload.upload_id
    
    async def get_upload_by_id(self, user_id: str, upload_id: str):
        upload = self._uploads.get(upload_id)
        if upload and upload.user_id == user_id:
            return upload.model_dump()
        return None
    
    async def get_upload_by_upload_id(self, upload_id: str):
        upload = self._uploads.get(upload_id)
        return upload.model_dump() if upload else None
    
    async def update_state(self, user_id: str, upload_id: str, *, to_state: UploadProcessState):
        upload = self._uploads.get(upload_id)
        if upload:
            upload.upload_process_state = to_state
    
    async def mark_state_injected(self, user_id: str, upload_id: str):
        self._injected_upload_ids.add(upload_id)
        upload = self._uploads.get(upload_id)
        if upload:
            upload.state_injected = True
    
    async def mark_injection_failed(self, user_id: str, upload_id: str, error: str):
        self._failed_injection_errors[upload_id] = error
        upload = self._uploads.get(upload_id)
        if upload:
            upload.state_injected = False
            upload.injection_error = error
    
    @property
    def injected_uploads(self):
        return self._injected_upload_ids
    
    @property
    def failed_injections(self):
        return self._failed_injection_errors


class InMemoryStateManager:
    """In-memory state manager for testing"""
    
    def __init__(self):
        self._states = {}
    
    async def get_state(self, session_id: int) -> ApplicationState:
        if session_id not in self._states:
            self._states[session_id] = ApplicationState.new_state(session_id=session_id)
        return self._states[session_id]
    
    async def save_state(self, state: ApplicationState):
        self._states[state.session_id] = state
    
    async def delete_state(self, session_id: int):
        self._states.pop(session_id, None)


class TestCVStateInjectionIntegration:
    """Integration tests for CV upload with state injection"""
    
    @pytest.mark.asyncio
    async def test_full_pipeline_injects_state_correctly(self, mocker):
        """Test that the full pipeline extracts, injects, and persists state"""
        # GIVEN a session and user
        given_session_id = 12345
        given_user_id = "test-user"
        given_file_bytes = b"fake pdf content"
        given_filename = "test.pdf"
        
        # AND an in-memory repository and storage service
        given_repository = InMemoryCVRepository()
        given_storage_service = MockCVCloudStorageService()
        
        # AND an in-memory application state manager
        given_state_manager = InMemoryStateManager()
        
        # AND a CV upload service
        class DummyStructuredExtractor:
            async def extract_structured_experiences(self, markdown_cv: str) -> CVStructuredExtraction:
                return CVStructuredExtraction(collected_data=[], experience_entities=[], extraction_metadata={})
        cv_upload_service = CVUploadService(
            repository=given_repository,
            cv_cloud_storage_service=given_storage_service,
            structured_extractor=DummyStructuredExtractor(),
            application_state_manager=given_state_manager
        )
        
        # AND application config with high limits
        mocker.patch("app.users.cv.service.get_application_config", return_value=type("C", (), {
            "cv_max_uploads_per_user": 999,
            "cv_rate_limit_per_minute": 999,
        })())
        
        # AND structured extraction data
        given_experience_title = "Test Job"
        given_company = "Test Corp"
        given_location = "Test City"
        given_start_date = "2020-01-01"
        given_end_date = "2022-12-31"
        given_experience_uuid = "test-exp-1"
        
        given_structured_extraction = CVStructuredExtraction(
            collected_data=[
                CollectedData(
                    index=0,
                    experience_title=given_experience_title,
                    company=given_company,
                    location=given_location,
                    start_date=given_start_date,
                    end_date=given_end_date,
                    paid_work=True,
                    work_type="waged-employee"
                )
            ],
            experience_entities=[
                ExperienceEntity(
                    uuid=given_experience_uuid,
                    experience_title=given_experience_title,
                    company=given_company,
                    location=given_location,
                    timeline=Timeline(start=given_start_date, end=given_end_date),
                    work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
                    responsibilities=ResponsibilitiesData(responsibilities=["Test responsibility"])
                )
            ],
            extraction_metadata={"total_experiences": 1}
        )
        
        # AND mocked structured extractor to return test data
        mocker.patch.object(cv_upload_service._structured_extractor, "extract_structured_experiences",
                           new=AsyncMock(return_value=given_structured_extraction))
        
        # AND mocked markdown conversion
        given_markdown = "# Test CV\n\nTest Job at Test Corp"
        mocker.patch("app.users.cv.service.convert_cv_bytes_to_markdown",
                    new=AsyncMock(return_value=given_markdown))
        
        # WHEN uploading a CV with a session_id
        returned_upload_id = await cv_upload_service.parse_cv(
            user_id=given_user_id,
            file_bytes=given_file_bytes,
            filename=given_filename,
            session_id=given_session_id
        )
        
        # Wait for background pipeline to complete
        await asyncio.sleep(0.5)
        
        # THEN upload should be marked as completed
        actual_upload = await given_repository.get_upload_by_id(given_user_id, returned_upload_id)
        assert actual_upload is not None
        assert actual_upload["upload_process_state"] == UploadProcessState.COMPLETED.value
        
        # AND state should be injected
        assert returned_upload_id in given_repository.injected_uploads
        
        # AND application state should have the injected data
        actual_application_state = await given_state_manager.get_state(given_session_id)
        
        # AND CollectExperiencesAgent state should have collected data
        assert len(actual_application_state.collect_experience_state.collected_data) > 0
        assert any(cd.experience_title == given_experience_title for cd in actual_application_state.collect_experience_state.collected_data)
        assert actual_application_state.collect_experience_state.first_time_visit is False
        
        # AND ExploreExperiencesAgent state should have experience entities
        assert len(actual_application_state.explore_experiences_director_state.experiences_state) > 0
        assert any(given_experience_uuid in key for key in actual_application_state.explore_experiences_director_state.experiences_state.keys())
        
        # AND SkillsExplorerAgent state should have experiences explored
        assert len(actual_application_state.skills_explorer_agent_state.experiences_explored) > 0
        assert any(given_experience_title in summary for summary in actual_application_state.skills_explorer_agent_state.experiences_explored)
        assert actual_application_state.skills_explorer_agent_state.first_time_for_experience.get(given_experience_uuid) is False
    
    @pytest.mark.asyncio
    async def test_pipeline_handles_injection_failure_gracefully(self, mocker):
        """Test that pipeline continues even if injection fails"""
        # GIVEN a session and user
        given_session_id = 12345
        given_user_id = "test-user"
        given_file_bytes = b"fake pdf content"
        given_filename = "test.pdf"
        
        # AND an in-memory repository and storage service
        given_repository = InMemoryCVRepository()
        given_storage_service = MockCVCloudStorageService()
        
        # AND a state manager that fails on get_state
        failing_state_manager = AsyncMock()
        failing_state_manager.get_state = AsyncMock(side_effect=Exception("State fetch failed"))
        failing_state_manager.save_state = AsyncMock()
        
        # AND a CV upload service
        class DummyStructuredExtractor:
            async def extract_structured_experiences(self, markdown_cv: str) -> CVStructuredExtraction:
                return CVStructuredExtraction(collected_data=[], experience_entities=[], extraction_metadata={})
        cv_upload_service = CVUploadService(
            repository=given_repository,
            cv_cloud_storage_service=given_storage_service,
            structured_extractor=DummyStructuredExtractor(),
            application_state_manager=failing_state_manager
        )
        
        # AND application config with high limits
        mocker.patch("app.users.cv.service.get_application_config", return_value=type("C", (), {
            "cv_max_uploads_per_user": 999,
            "cv_rate_limit_per_minute": 999,
        })())
        
        # AND empty structured extraction data
        given_empty_extraction = CVStructuredExtraction(
            collected_data=[],
            experience_entities=[],
            extraction_metadata={}
        )
        mocker.patch.object(cv_upload_service._structured_extractor, "extract_structured_experiences",
                           new=AsyncMock(return_value=given_empty_extraction))
        
        # AND mocked markdown conversion
        given_markdown = "# Test CV"
        mocker.patch("app.users.cv.service.convert_cv_bytes_to_markdown",
                    new=AsyncMock(return_value=given_markdown))
        
        # WHEN uploading with a session_id that will fail injection
        returned_upload_id = await cv_upload_service.parse_cv(
            user_id=given_user_id,
            file_bytes=given_file_bytes,
            filename=given_filename,
            session_id=given_session_id
        )
        
        # Wait for pipeline to complete
        await asyncio.sleep(0.5)
        
        # THEN upload should still complete
        actual_upload = await given_repository.get_upload_by_id(given_user_id, returned_upload_id)
        assert actual_upload is not None
        assert actual_upload["upload_process_state"] == UploadProcessState.COMPLETED.value
        
        # AND injection failure should be recorded
        assert returned_upload_id in given_repository.failed_injections
        assert actual_upload.get("injection_error") is not None

