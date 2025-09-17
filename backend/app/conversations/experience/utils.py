from app.agent.experience import WorkType, ExperienceEntity
from app.vector_search.esco_entities import SkillEntity

from ._types import SkillUpdate
from app.metrics.types import ActionLiteral


def _get_skills_update_value(update_value: list[SkillUpdate],
                             skills_map: dict[str, tuple[int, SkillEntity]]) -> list[tuple[int, SkillEntity]]:
    # New skills to be updated in the experience entity
    new_skills = []

    for skill_update in update_value:
        skill_uuid = skill_update['UUID']
        if skill_uuid in skills_map:
            # Create a copy to avoid modifying the skill in other experiences
            index, skill = skills_map[skill_uuid]

            # update the preferredLabel if it exists in the update
            # We are not worrying about alt labels, because the preferredLabel is the main label
            skill.preferredLabel = skill_update['preferredLabel']

            new_skills.append((index, skill))

    return new_skills


def _get_skills_update_values(experience_entity: ExperienceEntity,
                              update_value: list[SkillUpdate],
                              skills_map: dict[str, tuple[int, SkillEntity]]
                              ) -> tuple[list[tuple[int, SkillEntity]], list[tuple[int, SkillEntity]]]:
    all_skills = experience_entity.top_skills + experience_entity.remaining_skills

    new_top_skills = _get_skills_update_value(update_value, skills_map)

    new_top_skills_uuids = {skill.UUID for _, skill in new_top_skills}

    remaining_skills = [
        (index, skill) for index, skill in all_skills
        if skill.UUID not in new_top_skills_uuids
    ]

    return new_top_skills, remaining_skills


def update_experience_entity(experience_entity: ExperienceEntity[tuple[int, SkillEntity]], update_data: dict):
    """
    Update function to update an `experience_entity` with the provided `update_data`.

    The update is performed in-place.

    — If a field is unset:
        The field will not be updated.
    — If a field is set to `None`, or an empty list (`[]`):
        The field will be set to an empty list.
    — If a new value is provided:
        The field will be updated accordingly.

    For skill-related fields such as `top_skills` and `remaining_skills`,
    the update will preserve any existing values not explicitly overwritten.
    """

    experience_skills = experience_entity.top_skills + experience_entity.remaining_skills
    experience_skills_map = {skill.UUID: (index, skill) for index, skill in experience_skills}

    for field, value in update_data.items():
        if field == "top_skills":
            if value is None or value == []:
                # if the value was none,
                #   we will not update the top_skills field
                #   and put everything in remaining_skills, so that it can be got in the next update iteration.
                experience_entity.remaining_skills = experience_entity.top_skills + experience_entity.remaining_skills
                experience_entity.top_skills = []
            else:
                # compute the top_skills and remaining_skills given: remaining_skills = all_skills - top_skills
                top_skills, remaining_skills = _get_skills_update_values(experience_entity,
                                                                         value,
                                                                         experience_skills_map)

                experience_entity.top_skills = top_skills # type: ignore generics
                experience_entity.remaining_skills = remaining_skills # type: ignore generics
        elif field == "work_type":
            # the value of the work type is a string (the enum name)
            experience_entity.work_type = WorkType.from_string_key(value)
        else:
            setattr(experience_entity, field, value)


def compute_top_skill_changes(
        experience_entity: ExperienceEntity[tuple[int, SkillEntity]],
        new_top_skills_payload: list[SkillUpdate] | None
) -> dict[ActionLiteral, set[str]]:
    """
    Compare current top_skills with an incoming payload of updated top_skills.

    The result is a dictionary with three sets of UUIDs:
      - ADDED: skills newly introduced in the payload
      - DELETED: skills that were in current top_skills but not in the payload
      - EDITED: skills that exist in both but have a changed preferredLabel
    """

    if new_top_skills_payload is None:
        return {"ADDED": set(), "DELETED": set(), "EDITED": set()}

    # Current top_skills
    prev_map = {
        str(skill.UUID): str(skill.preferredLabel)
        for _, skill in (experience_entity.top_skills or [])
    }

    # New top_skills
    new_map: dict[str, str] = {
        update["UUID"]: update["preferredLabel"]
        for update in new_top_skills_payload
        if "UUID" in update and "preferredLabel" in update
    }

    # Compute set differences
    prev_ids, new_ids = set(prev_map), set(new_map)

    added   = new_ids - prev_ids      # in payload, not in current
    deleted = prev_ids - new_ids      # in current, missing in payload
    edited  = {sid for sid in prev_ids & new_ids if prev_map[sid] != new_map[sid]}

    return {"ADDED": added, "DELETED": deleted, "EDITED": edited}


def get_work_type_from_experience(experience_entity: ExperienceEntity) -> str | None:
    """
    Return the work_type string for the given experience entity.
    """
    if experience_entity.work_type is None:
        return "None"

    return experience_entity.work_type.name
