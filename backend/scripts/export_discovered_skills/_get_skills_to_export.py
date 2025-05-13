import logging

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.agent.agent_director.abstract_agent_director import AgentDirectorState
from app.agent.explore_experiences_agent_director import ExploreExperiencesAgentDirectorState
from app.server_dependencies.database_collections import Collections
from common_libs.environment_settings.constants import EmbeddingConfig

logger = logging.getLogger(__name__)


async def _get_skills_to_export(*,
                                taxonomy_db: AsyncIOMotorDatabase,
                                application_db: AsyncIOMotorDatabase,
                                conversations: list[dict]):
    """
    Get skills to export from conversations.
    """

    embeddings_config = EmbeddingConfig()

    explore_experiences_collection = application_db.get_collection(Collections.EXPLORE_EXPERIENCES_DIRECTOR_STATE)
    skills_collection = taxonomy_db.get_collection(embeddings_config.skill_collection_name)

    session_ids = []
    valid_conversations = []

    for conversation in conversations:
        try:
            conversation_state = AgentDirectorState.from_document(conversation)
            session_ids.append(conversation_state.session_id)
            valid_conversations.append((conversation, conversation_state))
        except Exception as e:
            logger.warning("Skipping conversation due to missing or invalid fields: %s", str(e))
            continue

    ##################################################################
    #         list[ExploreExperiencesAgentDirectorState]
    ##################################################################
    explore_experiences_states = await explore_experiences_collection.find({
        "session_id": {
            "$in": session_ids
        }}).to_list(length=None)

    # map of session_id to ExploreExperiencesAgentDirectorState
    # { session_id: ExploreExperiencesAgentDirectorState }.
    explore_experiences_states_map: dict[int, ExploreExperiencesAgentDirectorState] = {}
    for explore_experiences_state_doc in explore_experiences_states:
        explore_experiences_state = ExploreExperiencesAgentDirectorState.from_document(explore_experiences_state_doc)
        explore_experiences_states_map[explore_experiences_state.session_id] = explore_experiences_state


    # map of model_id to list of skills UUIDs
    # Used to build the optimized query to get the skills from the database.
    skills_uuids_by_model_id = {}
    for explore_experiences_state_doc in explore_experiences_states:
        explore_experiences_state = ExploreExperiencesAgentDirectorState.from_document(explore_experiences_state_doc)
        for experience in explore_experiences_state.experiences_state.values():
            for skill in experience.experience.top_skills:
                _uuids = skills_uuids_by_model_id.get(skill.modelId, [])
                _uuids.append(skill.UUID)
                skills_uuids_by_model_id[skill.modelId] = _uuids



    skills = []
    for model_id, skills_uuids in skills_uuids_by_model_id.items():
        _skills = await skills_collection.find(
            {
                "modelId": {"$eq": ObjectId(model_id) if model_id else None},
                "UUID": {"$in": list(set(skills_uuids))}
            },
            {
                "UUID": 1,
                "UUIDHistory": 1,
                "originUUID": 1,
            }).to_list(length=None)

        skills += _skills

    skills_map = {}
    for skill in skills:
        skills_map[skill["UUID"]] = skill

    exportable_skills = []
    for conversation, conversation_state in valid_conversations:
        explore_experiences_state = explore_experiences_states_map.get(conversation_state.session_id)

        if explore_experiences_state is None:
            logger.warning("No explore experiences state found for session ID: %s", conversation_state.session_id)
            continue

        for experience in explore_experiences_state.experiences_state.values():
            for skill in experience.experience.top_skills:
                skill_doc = skills_map.get(skill.UUID)
                if skill_doc is None:
                    logger.warning("No skill found for UUID: %s", skill.UUID)
                    continue

                exportable_skills.append(dict(
                    model_id=skill.modelId,
                    conversation_id=conversation_state.session_id,
                    conversation_phase=conversation_state.current_phase.name,
                    experience_id=experience.experience.uuid,
                    uuid=skill.UUID,
                    uuid_history=skill_doc.get("UUIDHistory", [skill.UUID]),
                    origin_uuid=skill_doc.get("originUUID", skill.UUID),
                    preferred_label=skill.preferredLabel,
                    alt_labels=skill.altLabels,
                    description=skill.description,
                    skill_type=skill.skillType
                ))

    return exportable_skills
