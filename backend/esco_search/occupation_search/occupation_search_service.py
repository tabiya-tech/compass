from typing import List

from pydantic.main import BaseModel

from esco_search.esco_abs_search_service import AbstractEscoSearchService


class OccupationEntity(BaseModel):
    id: str
    preferredLabel: str
    UUID: str
    code: str
    preferredLabel: str
    description: str
    altLabels: List[str]


class OccupationSearchService(AbstractEscoSearchService[OccupationEntity]):
    """
    A class to perform similarity searches on the occupations collection.
    """

    def to_entity(self, doc: dict) -> OccupationEntity:
        """
        Convert a Document object to an OccupationDocument object.
        """

        return OccupationEntity(
            id=str(doc.get("_id", "")),
            UUID=doc.get("UUID", ""),
            code=doc.get("code", ""),
            preferredLabel=doc.get("preferredLabel", ""),
            description=doc.get("description", ""),
            altLabels=doc.get("altLabels", []),
        )
