import uuid
from typing import Optional

from bson import ObjectId

from app.vector_search.esco_entities import SkillEntity


def get_skill_entity(*, preferred_label: str, altlabels: Optional[list[str]] = None, description: Optional[str] = "",
                     score: Optional[float] = 0) -> SkillEntity:
    return SkillEntity(
        id=f"{uuid.uuid4().hex[:24]}",  # id is a random sting 24 character hex string
        UUID=f"{uuid.uuid4()}",
        modelId=f"{str(ObjectId())}",
        preferredLabel=preferred_label,
        altLabels=altlabels if altlabels is not None else [preferred_label],  # the preferred label is usually expected to be in the altlabels
        description=description,
        skillType="skill/competence",  # We do not care about the skill type
        score=score
    )
