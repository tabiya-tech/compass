from pydantic import BaseModel
from datetime import datetime


class UserLanguage(BaseModel):
    user_id: str
    language: str


class UserPreferences(UserLanguage):
    accepted_tc: datetime
