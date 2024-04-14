from typing import List

from pydantic import BaseModel

from esco_search.esco_abs_search_service import AbstractEscoSearchService


class SkillEntity(BaseModel):
    """
    Represents a skill entity.
    """
    id: str
    UUID: str
    preferredLabel: str
    description: str
    altLabels: List[str]
    skillType: str


class SkillSearchService(AbstractEscoSearchService[SkillEntity]):
    """
    A service class to perform similarity searches on the skills collection.
    """

    def to_entity(self, doc: dict) -> SkillEntity:
        """
        Convert a Document object to a SkillEntity object.
        """

        return SkillEntity(
            id=str(doc.get("_id", "")),
            UUID=doc.get("UUID", ""),
            preferredLabel=doc.get("preferredLabel", ""),
            description=doc.get("description", ""),
            altLabels=doc.get("altLabels", []),
            skillType=doc.get("skillType", ""),
        )
