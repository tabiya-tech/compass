#!/usr/bin/env python3
import argparse
import asyncio
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

import pandas as pd
from motor.motor_asyncio import AsyncIOMotorDatabase
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

from app.server_dependencies.database_collections import Collections
from common_libs.logging.log_utilities import setup_logging_config
from constants import SCRIPT_DIR, DEFAULT_EXPORTS_DIR
from scripts.conversation_analysis.helpers import _get_compass_version, _compute_session_flags, _get_session_data, _get_demographics_for_user, \
    _assign_group, _is_date_in_range
from scripts.conversation_analysis.utils import _valid_datetime, _get_db_connection, initialize_files

# Load environment and logging
load_dotenv()
setup_logging_config(os.path.join(SCRIPT_DIR, "logging.cfg.yaml"))
logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    application_mongodb_uri: str
    application_database_name: str
    userdata_mongodb_uri: str
    userdata_database_name: str

    class Config:
        env_prefix = "ANALYZE_CONVERSATIONS_"


def _parse_session_data(
        session: Dict[str, Any],
        session_to_user: Dict[int, str],
        tc_map: Dict[str, bool],
        created_at_map: Dict[int, Any],
        pii_map: Dict[str, bool],
        users_with_multiple_sessions: Dict[str, bool],
        conversation_link_base: str = None
) -> Dict[str, Any]:
    session_id = session["session_id"]
    user_id = session_to_user.get(session_id)

    memory = session.get("conversation_memory", {})
    turns = memory.get("all_history", {}).get("turns", [])

    conversation_started_at = turns[0]["input"].get("sent_at") if turns else None
    last_message_at = turns[-1]["output"].get("sent_at") if turns else None

    user_messages = sum(
        1 for t in turns
        if not t.get("input", {}).get("is_artificial", True)
        and t.get("input", {}).get("message") != "(silence)"
    )
    agent_messages = sum(1 for t in turns if t.get("output") is not None)
    counseling_messages = max(0, sum(
        1 for t in turns
        if (t.get("output", {}).get("agent_type") == "COLLECT_EXPERIENCES_AGENT")
        and not t.get("input", {}).get("is_artificial", True)
        and t.get("input", {}).get("message") != "(silence)"
    ))

    collect_data = session.get("collect_experiences", {}).get("collected_data", {})
    discovered_experiences = (
        len([
            exp for exp in collect_data
            if isinstance(exp, dict) and any([
                exp.get("company") not in [None, "null", ""],
                exp.get("location") not in [None, "null", ""],
                exp.get("start_date") not in [None, "null", ""],
                exp.get("end_date") not in [None, "null", ""]
            ])
        ]) if isinstance(collect_data, list) else 0
    )

    explore_data = session.get("explore_experiences", {}).get("experiences_state", {})
    explored_experiences = sum(
        1 for exp in explore_data.values()
        if isinstance(exp, dict) and exp.get("dive_in_phase") == "PROCESSED"
    )

    conversation_phase = session.get("current_phase")
    dive_in_phase = session.get("explore_experiences", {}).get("conversation_phase")
    if dive_in_phase == "DIVE_IN" and conversation_phase == "COUNSELING":
        conversation_phase = "DIVE_IN"
    elif dive_in_phase == "COLLECT_EXPERIENCES" and conversation_phase == "COUNSELING":
        conversation_phase = "COLLECT_EXPERIENCES"

    user_created_at = created_at_map.get(session_id) or session.get("conversation_conducted_at")

    if conversation_link_base:
        conversation_link = f"{conversation_link_base.rstrip('/')}/{session_id}/conversation.md"
    else:
        conversation_link = None

    session_dict = {
        "session_id": session_id,
        "user_created_at": user_created_at,
        "user_gave_pii": pii_map.get(user_id, False) if user_id else False,
        "accepted_terms_and_conditions": tc_map.get(user_id, False) if user_id else False,
        "user_never_started_conversation": False,
        "user_messages": user_messages,
        "agent_messages": agent_messages,
        "counseling_messages": counseling_messages,
        "discovered_experiences": discovered_experiences,
        "explored_experiences": explored_experiences,
        "current_phase": conversation_phase,
        "conversation_started_at": conversation_started_at,
        "last_message_at": last_message_at,
        "has_multiple_sessions": users_with_multiple_sessions.get(user_id, False),
        "compass_version": _get_compass_version(user_created_at),
        **_get_demographics_for_user(user_id),
        "conversation_link": conversation_link
    }

    flags = _compute_session_flags(session_dict)
    session_dict.update(flags)

    return session_dict


async def _get_sessions_with_app_state(application_db: AsyncIOMotorDatabase,
                                       users_with_multiple_sessions: Dict[str, bool],
                                       session_ids: List[int],
                                       pii_map: Dict[str, bool],
                                       conversation_link_base: str = None) -> List[Dict[str, Any]]:

    sessions = await _get_session_data(application_db, session_ids)

    user_prefs = await application_db.get_collection(Collections.USER_PREFERENCES).find(
        {"sessions": {"$in": session_ids}},
        {"user_id": 1, "accepted_tc": 1, "sessions": 1, "created_at": 1}
    ).to_list(length=None)

    session_to_user = {
        sid: pref["user_id"]
        for pref in user_prefs
        for sid in pref.get("sessions", [])
    }
    tc_map = {pref["user_id"]: bool(pref.get("accepted_tc")) for pref in user_prefs}
    created_at_map = {
        sid: pref["created_at"]
        for pref in user_prefs
        for sid in pref.get("sessions", [])
        if "created_at" in pref
    }

    return [
        _parse_session_data(
            session,
            session_to_user,
            tc_map,
            created_at_map,
            pii_map,
            users_with_multiple_sessions,
            conversation_link_base
        )
        for session in sessions
    ]


def _get_sessions_with_no_app_state(
        all_users: List[Dict[str, Any]],
        sessions_with_state: set,
        user_prefs_map: Dict[str, bool],
        users_with_multiple_sessions: Dict[str, bool],
        created_at_map: Dict[str, Any],
        conversation_link_base: str = None
) -> List[Dict[str, Any]]:
    results = []
    for user in all_users:
        user_id = user["user_id"]
        user_created_at = created_at_map.get(user_id, None)

        for sid in user.get("sessions", []):
            if sid in sessions_with_state:
                continue

            if conversation_link_base:
                conversation_link = f"{conversation_link_base.rstrip('/')}/{sid}/conversation.md"
            else:
                conversation_link = None

            session_dict = {
                "session_id": sid,
                "user_created_at": user_created_at,
                "user_gave_pii": False,
                "accepted_terms_and_conditions": user_prefs_map.get(user_id, False),
                "user_never_started_conversation": True,
                "user_messages": 0,
                "agent_messages": 0,
                "counseling_messages": 0,
                "discovered_experiences": 0,
                "explored_experiences": 0,
                "current_phase": None,
                "conversation_started_at": None,
                "last_message_at": None,
                "has_multiple_sessions": users_with_multiple_sessions.get(user_id, False),
                "compass_version": _get_compass_version(user_created_at),
                **_get_demographics_for_user(user_id),
                "conversation_link": conversation_link,
            }
            # we expect that the session flags will always be false for these sessions
            flags = _compute_session_flags(session_dict)
            session_dict.update(flags)
            results.append(session_dict)

    return results


"""
Analyze user sessions and return a list of dictionaries with session data and flags.
"""


async def analyze_sessions(application_db: AsyncIOMotorDatabase,
                           userdata_db: AsyncIOMotorDatabase,
                           start_datetime: Optional[datetime] = None,
                           end_datetime: Optional[datetime] = None,
                           conversation_link_base: str = None
                           ) -> List[Dict[str, Any]]:
    # Normalize datetimes to naive UTC
    if start_datetime and start_datetime.tzinfo is not None:
        start_datetime = start_datetime.astimezone(timezone.utc).replace(tzinfo=None)
    if end_datetime and end_datetime.tzinfo is not None:
        end_datetime = end_datetime.astimezone(timezone.utc).replace(tzinfo=None)

    all_users = await application_db.get_collection(Collections.USER_PREFERENCES).find(
        {}, {"user_id": 1, "accepted_tc": 1, "sessions": 1, "created_at": 1}
    ).to_list(length=None)

    user_prefs_map = {u["user_id"]: bool(u.get("accepted_tc")) for u in all_users}
    users_with_multiple_sessions = {u["user_id"]: len(u.get("sessions", [])) > 1 for u in all_users}
    created_at_map = {u["user_id"]: u.get("created_at") for u in all_users}

    pii_data = await userdata_db.get_collection(Collections.SENSITIVE_PERSONAL_DATA).find(
        {}, {"user_id": 1, "sensitive_personal_data": 1}
    ).to_list(length=None)

    pii_map = {
        d["user_id"]: bool(d["sensitive_personal_data"].get("aes_encrypted_data"))
        for d in pii_data if d.get("sensitive_personal_data") is not None
    }

    query = {}
    if start_datetime and end_datetime:
        query["conversation_conducted_at"] = {"$gte": start_datetime, "$lt": end_datetime}
    elif start_datetime:
        query["conversation_conducted_at"] = {"$gte": start_datetime}
    elif end_datetime:
        query["conversation_conducted_at"] = {"$lt": end_datetime}

    session_ids = await application_db.get_collection(Collections.AGENT_DIRECTOR_STATE).distinct("session_id", query)
    sessions_with_state = set(session_ids)

    # Filter all_users for no_app_sessions by date range only if a date filter is provided
    if start_datetime or end_datetime:
        filtered_all_users = [
            user for user in all_users
            if _is_date_in_range(user.get("created_at"), start_datetime, end_datetime)
        ]
    else:
        filtered_all_users = all_users

    # Collect both types
    app_sessions = await _get_sessions_with_app_state(application_db, users_with_multiple_sessions, session_ids, pii_map, conversation_link_base)
    no_app_sessions = _get_sessions_with_no_app_state(
        filtered_all_users, sessions_with_state,
        user_prefs_map, users_with_multiple_sessions,
        created_at_map,
        conversation_link_base
    )

    return app_sessions + no_app_sessions


def _parse_args():
    parser = argparse.ArgumentParser(
        description="Analyze user sessions with various metrics and flags.",
        formatter_class=argparse.RawTextHelpFormatter,
        epilog="""
Required files:
  --demographics-file  Path to the CSV file containing user demographics data
  --deployments-file   Path to the JSON file containing deployment history

Environment Variables:
  ANALYZE_CONVERSATIONS_APPLICATION_MONGODB_URI     MongoDB connection URI for application database
  ANALYZE_CONVERSATIONS_APPLICATION_DATABASE_NAME   Database name for application
  ANALYZE_CONVERSATIONS_USERDATA_MONGODB_URI       MongoDB connection URI for user data database
  ANALYZE_CONVERSATIONS_USERDATA_DATABASE_NAME     Database name for user data
"""
    )
    
    required = parser.add_argument_group('required arguments')
    required.add_argument(
        "--demographics-file",
        type=str,
        required=True,
        help="Path to the demographics CSV file"
    )
    required.add_argument(
        "--deployments-file",
        type=str,
        required=True,
        help="Path to the deployments JSON file"
    )

    optional = parser.add_argument_group('optional arguments')
    optional.add_argument(
        "--start-datetime",
        type=_valid_datetime,
        help="Start datetime (format: 'YYYY-MM-DD HH:MM:SS')"
    )
    optional.add_argument(
        "--end-datetime",
        type=_valid_datetime,
        help="End datetime (format: 'YYYY-MM-DD HH:MM:SS')"
    )
    optional.add_argument(
        "--output-dir",
        type=str,
        default=DEFAULT_EXPORTS_DIR,
        help=f"Directory to save the output CSV. Default: {DEFAULT_EXPORTS_DIR}"
    )
    optional.add_argument(
        "--conversation-link-base",
        type=str,
        default=None,
        help="Base path or URL for conversation links (e.g. a SharePoint or local folder). If not provided, conversation_link will be None."
    )
    
    return parser.parse_args()


async def main():
    args = _parse_args()
    settings = Settings()

    # Initialize file paths
    initialize_files(
        demographics_file=args.demographics_file,
        deployments_file=args.deployments_file
    )

    # Initialize database connections
    application_db = _get_db_connection(settings.application_mongodb_uri, settings.application_database_name)
    userdata_db = _get_db_connection(settings.userdata_mongodb_uri, settings.userdata_database_name)

    try:
        logger.info("Analyzing sessions...")
        results = await analyze_sessions(application_db, userdata_db, args.start_datetime, args.end_datetime, args.conversation_link_base)

        df = pd.DataFrame(results)
        df["group"] = df.apply(_assign_group, axis=1)

        os.makedirs(args.output_dir, exist_ok=True)
        output_path = os.path.join(args.output_dir, f"session_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
        df.to_csv(output_path, index=False)
        logger.info(f"Analysis exported to {output_path}")

    except Exception as e:
        logger.exception(f"Error during export: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
