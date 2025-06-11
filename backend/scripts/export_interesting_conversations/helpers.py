import hashlib
from datetime import datetime
from typing import Optional, Any, List, Dict

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.server_dependencies.database_collections import Collections
from scripts.export_interesting_conversations.utils import _load_deployments_from_file, _load_demographics_from_file

# Load deployments from a JSON file
deployments = _load_deployments_from_file()

# Load demographics from a CSV file
demographics = _load_demographics_from_file()


def _get_compass_version(date_input: Optional[Any]) -> Optional[str]:
    if not isinstance(date_input, datetime):
        return None
    for i in range(len(deployments) - 1, -1, -1):
        deployment_date, deployment_label = deployments[i]
        if date_input >= deployment_date:
            return f"{i}: {deployment_label}"
    return None


def _get_demographics_for_user(user_id: str) -> dict:
    """
    Get demographics for a user from the demographic map.

    :param user_id: The user ID to look up.
    :return: A dictionary with demographics data or {} if not found.
    """
    # Use hashed user_id for demographic lookup
    actual_user_demographics = demographics.get(
        hashlib.md5(user_id.encode(), usedforsecurity=False).hexdigest(), {}
    ) if user_id else {}
    if not actual_user_demographics:
        return {}
    return {
        "gender": actual_user_demographics.get("gender"),
        "age": actual_user_demographics.get("age"),
        "education_status": actual_user_demographics.get("education_status"),
        "main_activity": actual_user_demographics.get("main_activity"),
        # **actual_user_demographics, # replace specific demographic fields with this if you want to include all demographics
    }


def _compute_session_flags(session_data: dict) -> dict:
    """Compute boolean flags for a session based on its attributes."""
    return {
        "is_never_left_intro": (
                not session_data.get("user_never_started_conversation", False)
                and session_data.get("current_phase") == "INTRO"
                and not session_data.get("has_multiple_sessions", False)
        ),
        "is_counseling_but_no_messages": (
                not session_data.get("user_never_started_conversation", False)
                and session_data.get("counseling_messages", 0) == 1
                and session_data.get("current_phase") == "COUNSELING"
        ),
        "is_counseling_but_no_discovered": (
                not session_data.get("user_never_started_conversation", False)
                and session_data.get("discovered_experiences", 0) == 0
                and session_data.get("current_phase") == "COUNSELING"
        ),
        "is_discovered_but_no_explored": (
                session_data.get("discovered_experiences", 0) > 0
                and session_data.get("explored_experiences", 0) == 0
        ),
        "is_explored_1_but_not_completed": (
                session_data.get("explored_experiences", 0) == 1
                and session_data.get("current_phase") != "ENDED"
        ),
        "is_explored_gt1_but_not_complete": (
                session_data.get("explored_experiences", 0) > 1
                and session_data.get("current_phase") != "ENDED"
        ),
    }


async def _get_session_data(application_db: AsyncIOMotorDatabase, session_ids: List[int]) -> List[Dict[str, Any]]:
    return await application_db.get_collection(Collections.AGENT_DIRECTOR_STATE).aggregate([
        {"$match": {"session_id": {"$in": session_ids}}},
        {"$lookup": {
            "from": Collections.CONVERSATION_MEMORY_MANAGER_STATE,
            "localField": "session_id",
            "foreignField": "session_id",
            "as": "conversation_memory"
        }},
        {"$lookup": {
            "from": Collections.EXPLORE_EXPERIENCES_DIRECTOR_STATE,
            "localField": "session_id",
            "foreignField": "session_id",
            "as": "explore_experiences"
        }},
        {"$addFields": {
            "conversation_memory": {"$arrayElemAt": ["$conversation_memory", 0]},
            "explore_experiences": {"$arrayElemAt": ["$explore_experiences", 0]}
        }}
    ]).to_list(length=None)
