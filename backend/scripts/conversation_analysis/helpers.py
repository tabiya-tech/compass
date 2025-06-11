import hashlib
from datetime import datetime
from typing import Optional, Any, List, Dict

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.server_dependencies.database_collections import Collections
from scripts.conversation_analysis.utils import _load_deployments_from_file, _load_demographics_from_file

# Global variables to cache loaded data
_deployments = None
_demographics = None


def _get_compass_version(date_input: Optional[Any]) -> Optional[str]:
    """
    Get the compass version based on the deployment date.
    """
    global _deployments
    
    if not isinstance(date_input, datetime):
        return None

    # Load deployments if not already loaded
    if _deployments is None:
        _deployments = _load_deployments_from_file()

    for i in range(len(_deployments) - 1, -1, -1):
        deployment_date, deployment_label = _deployments[i]
        if date_input >= deployment_date:
            return f"{i}: {deployment_label}"
    return None


def _assign_group(row: dict) -> str:
    if row.get("user_never_started_conversation", False):
        return "Group 5"  # No Engagement
    elif row.get("current_phase") == "ENDED":
        return "Group 4"  # Successful Engagement
    elif any([
        row.get("is_explored_gt1_but_not_complete", False),
        row.get("is_explored_1_but_not_completed", False),
    ]):
        return "Group 3"  # High Engagement: explored one or more experiences
    elif row.get("is_discovered_but_no_explored", False):
        return "Group 2"  # Moderate Engagement: discovered, but explored none
    elif any([
        row.get("is_never_left_intro", False),
        row.get("is_counseling_but_no_messages", False),
        row.get("is_counseling_but_no_discovered", False)
    ]):
        return "Group 1"  # Low Engagement: didn't progress beyond early steps
    else:
        return "Unknown"  # Session does not match any known behavioral pattern


def _get_demographics_for_user(user_id: str) -> dict:
    """
    Get demographics for a user from the demographic map.

    :param user_id: The user ID to look up.
    :return: A dictionary with demographics data or {} if not found.
    """
    global _demographics

    # Load demographics if not already loaded
    if _demographics is None:
        _demographics = _load_demographics_from_file()

    # Use hashed user_id for demographic lookup
    actual_user_demographics = _demographics.get(
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
        ),
        "is_counseling_but_no_messages": (
                not session_data.get("user_never_started_conversation", False)
                and int(session_data.get("counseling_messages") or 0) == 0
                and session_data.get("current_phase") not in ["ENDED", "INTRO"]
        ),
        "is_counseling_but_no_discovered": (
                not session_data.get("user_never_started_conversation", False)
                and int(session_data.get("counseling_messages") or 0) > 0
                and int(session_data.get("discovered_experiences") or 0) == 0
                and session_data.get("current_phase") not in ["ENDED", "INTRO"]
        ),
        "is_discovered_but_no_explored": (
                not session_data.get("user_never_started_conversation", False)
                and int(session_data.get("counseling_messages") or 0) > 1
                and int(session_data.get("discovered_experiences") or 0) > 0
                and int(session_data.get("explored_experiences") or 0) == 0
        ),
        "is_explored_1_but_not_completed": (
                int(session_data.get("explored_experiences") or 0) == 1
                and session_data.get("current_phase") != "ENDED"
        ),
        "is_explored_gt1_but_not_complete": (
                int(session_data.get("explored_experiences") or 0) > 1
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
        {"$lookup": {
            "from": Collections.COLLECT_EXPERIENCE_STATE,
            "localField": "session_id",
            "foreignField": "session_id",
            "as": "collect_experiences"
        }},
        {"$addFields": {
            "conversation_memory": {"$arrayElemAt": ["$conversation_memory", 0]},
            "explore_experiences": {"$arrayElemAt": ["$explore_experiences", 0]},
            "collect_experiences": {"$arrayElemAt": ["$collect_experiences", 0]}
        }}
    ]).to_list(length=None)

# Helper to check if a date is in range
def _is_date_in_range(dt, start_datetime, end_datetime):
    if dt is None:
        return False
    if start_datetime and dt < start_datetime:
        return False
    if end_datetime and dt >= end_datetime:
        return False
    return True