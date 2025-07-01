from app.agent.experience import WorkType


def update_experience_entity(experience_entity, update_data, all_skills):
    """ Helper function to update an experience_entity with the provided update_data.
     > mutates the experience_entity in place.
     if value is None, [] or unset, top_skills is set to an empty list
     if otherwise we update the preferredLabel of the skill in the experience_entity
    """

    for field, value in update_data.items():
        if field == "top_skills":
            if value is None:
                experience_entity.top_skills = []
            else:
                new_top_skills = []
                for skill_update in value:
                    skill_uuid = skill_update['UUID']
                    if skill_uuid in all_skills:
                        # Create a copy to avoid modifying the skill in other experiences
                        skill_to_add = all_skills[skill_uuid].model_copy(deep=True)
                        skill_to_add.preferredLabel = skill_update['preferredLabel']
                        new_top_skills.append(skill_to_add)
                experience_entity.top_skills = new_top_skills
        elif field == "work_type":
            # the value of the work type is a string (the enum name)
            experience_entity.work_type = WorkType.from_string_key(value)
        else:
            setattr(experience_entity, field, value)
