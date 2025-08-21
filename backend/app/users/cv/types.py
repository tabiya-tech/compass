from pydantic import BaseModel


class CVUploadResponse(BaseModel):
    experiences_data: str


