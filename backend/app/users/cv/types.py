from datetime import datetime, timezone
from enum import Enum
import uuid
from typing import Optional

from pydantic import BaseModel, Field
from app.agent.collect_experiences_agent._types import CollectedData
from app.agent.experience.experience_entity import ExperienceEntity


class CVUploadStateResponse(BaseModel):
    upload_id: str


class UploadProcessState(str, Enum):
    PENDING_UPLOAD = "PENDING_UPLOAD"
    UPLOADING = "UPLOADING"
    CONVERTING = "CONVERTING"
    UPLOADING_TO_GCS = "UPLOADING_TO_GCS"
    EXTRACTING = "EXTRACTING"
    SAVING = "SAVING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class ParsedCV(BaseModel):
    experiences_data: list[str]
    upload_id: str


class CVUploadListItemResponse(BaseModel):
    """Response model for a single CV upload in the list endpoint"""
    upload_id: str
    filename: str
    uploaded_at: str
    upload_process_state: UploadProcessState


class CVUploadStatusResponse(BaseModel):
    upload_id: str
    user_id: str
    filename: str
    upload_process_state: UploadProcessState
    cancel_requested: bool
    created_at: datetime
    last_activity_at: datetime
    error_code: Optional['CVUploadErrorCode'] = None
    error_detail: str | None = None
    state_injected: bool | None = None
    injection_error: str | None = None


class CVUploadErrorCode(str, Enum):
    DUPLICATE_CV_UPLOAD = "DUPLICATE_CV_UPLOAD"
    MARKDOWN_TOO_LONG = "MARKDOWN_TOO_LONG"
    MARKDOWN_CONVERSION_TIMEOUT = "MARKDOWN_CONVERSION_TIMEOUT"
    EMPTY_MARKDOWN = "EMPTY_MARKDOWN"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    LIMIT_EXCEEDED = "LIMIT_EXCEEDED"
    STORAGE_ERROR = "STORAGE_ERROR"
    UNKNOWN_ERROR = "UNKNOWN_ERROR"


class UserCVUpload(BaseModel):
    user_id: str = Field(description="The user id")
    created_at: datetime = Field(description="The date and time the upload was recorded")
    filename: str = Field(description="Original filename used for upload")
    content_type: str = Field(description="MIME type of the uploaded file")
    object_path: str = Field(description="GCS object path where the original file is stored")
    markdown_object_path: str = Field(description="GCS object path where markdown is stored")
    markdown_char_len: int = Field(description="Character length of markdown")
    md5_hash: str = Field(description="MD5 hash of the original file content")
    upload_id: str = Field(default_factory=lambda: uuid.uuid4().hex, description="Unique upload identifier")
    upload_process_state: UploadProcessState = Field(
        default=UploadProcessState.PENDING_UPLOAD,
        description="Current state of the upload pipeline",
    )
    cancel_requested: bool = Field(default=False, description="Whether a cancellation was requested")
    last_activity_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of last state change or activity",
    )
    # Optional error fields populated when FAILED
    error_code: str | None = Field(default=None, description="Machine-readable error code for failed uploads")
    error_detail: str | None = Field(default=None, description="Human-readable error detail for failed uploads")
    # State injection reporting
    state_injected: bool = Field(default=False, description="Whether state was successfully injected")
    injection_error: str | None = Field(default=None, description="Error message if injection failed")
    # Structured extraction data stored when COMPLETED
    structured_extraction: 'CVStructuredExtraction | None' = Field(default=None,
                                                                     description="Structured extraction data for reinjection")


class CVStructuredExtraction(BaseModel):
    """Structured extraction result compatible with agent states"""
    collected_data: list[CollectedData]
    experience_entities: list[ExperienceEntity]
    extraction_metadata: dict
