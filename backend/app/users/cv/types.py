from datetime import datetime

from pydantic import BaseModel, Field


class ParsedCV(BaseModel):
    experiences_data: list[str]


class UserCVUpload(BaseModel):
    user_id: str = Field(description="The user id")
    created_at: datetime = Field(description="The date and time the upload was recorded")
    filename: str = Field(description="Original filename used for upload")
    content_type: str = Field(description="MIME type of the uploaded file")
    object_path: str = Field(description="GCS object path where the original file is stored")
    markdown_object_path: str = Field(description="GCS object path where markdown is stored")
    markdown_char_len: int = Field(description="Character length of markdown")
