from pydantic import BaseModel
from datetime import datetime
from enum import Enum


class UpdateUserLanguageRequest(BaseModel):
    user_id: str
    language: str


class UserPreferencesUpdateRequest(BaseModel):
    language: str = None
    accepted_tc: datetime = None
    sessions: list[int] = None  # not required


class UserPreferences(BaseModel):
    language: str
    accepted_tc: datetime
    sessions: list[int] = []  # not required


class CreateUserPreferencesRequest(BaseModel):
    user_id: str
    language: str
    accepted_tc: datetime
    sessions: list[int] = []
