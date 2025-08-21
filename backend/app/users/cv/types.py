from pydantic import BaseModel


class ParsedCV(BaseModel):
    experiences_data: list[str]

