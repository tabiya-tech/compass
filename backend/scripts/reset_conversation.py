#!/usr/bin/env python3
"""
Reset conversation state for a user in local development.

Usage:
    # Reset all conversations for a user
    python scripts/reset_conversation.py --user-id <USER_ID> --all

    # Omit --user-id to pick a user interactively from MongoDB
    python scripts/reset_conversation.py --all

    # Reset only the skills & interest conversation (session_id required)
    python scripts/reset_conversation.py --user-id <USER_ID> --skills --session-id 1

    # Reset only career readiness conversations
    python scripts/reset_conversation.py --user-id <USER_ID> --career-readiness

    # Reset only the career explorer conversation
    python scripts/reset_conversation.py --user-id <USER_ID> --career-explorer

    # Combine any of them
    python scripts/reset_conversation.py --user-id <USER_ID> --skills --session-id 1 --career-readiness

    # List available session IDs for a user (to find your session_id)
    python scripts/reset_conversation.py --user-id <USER_ID> --list-sessions

Reads MongoDB connection details from the backend .env file automatically.
"""

import argparse
import asyncio
import os
import sys

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient


# Collections for the skills & interest conversation (keyed by session_id)
SKILLS_COLLECTIONS = [
    "agent_director_state",
    "welcome_agent_state",
    "explore_experiences_director_state",
    "conversation_memory_manager_state",
    "collect_experience_state",
    "skills_explorer_agent_state",
    "preference_elicitation_agent_state",
    "recommender_advisor_agent_state",
]

# Career readiness collection (keyed by user_id)
CAREER_READINESS_COLLECTION = "career_readiness_conversations"

# Career explorer collection (keyed by user_id)
CAREER_EXPLORER_COLLECTION = "career_explorer_conversations"


async def preview_conversation(db, collection: str, query: dict):
    """Show message count and last exchange for a conversation document."""
    doc = await db[collection].find_one(query)
    if not doc:
        print("  (no document found)")
        return
    messages = doc.get("messages", [])
    print(f"  Messages: {len(messages)}")
    if not messages:
        return
    # Show the last two messages (typically user + agent)
    last_msgs = messages[-2:] if len(messages) >= 2 else messages
    print("  Last exchange:")
    for msg in last_msgs:
        sender = msg.get("sender", msg.get("role", "?"))
        text = msg.get("message", msg.get("content", ""))
        if isinstance(text, dict):
            text = text.get("content", "")
        text = str(text).replace("\n", " ")[:120]
        print(f"    [{sender}] {text}")


async def reset_skills(app_db, session_id: int) -> int:
    """Reset all skills & interest conversation state for a session."""
    deleted = 0
    tasks = []
    for col_name in SKILLS_COLLECTIONS:
        tasks.append(app_db[col_name].delete_one({"session_id": {"$eq": session_id}}))
    results = await asyncio.gather(*tasks)
    deleted = sum(r.deleted_count for r in results)
    return deleted


async def reset_career_readiness(app_db, user_id: str) -> int:
    """Reset all career readiness conversations for a user."""
    result = await app_db[CAREER_READINESS_COLLECTION].delete_many({"user_id": {"$eq": user_id}})
    return result.deleted_count


async def reset_career_explorer(ce_db, user_id: str) -> int:
    """Reset the career explorer conversation for a user."""
    result = await ce_db[CAREER_EXPLORER_COLLECTION].delete_one({"user_id": {"$eq": user_id}})
    return result.deleted_count


async def list_sessions(app_db):
    """List session IDs from agent_director_state. Useful to find your session_id."""
    cursor = app_db["agent_director_state"].find({}, {"session_id": 1, "_id": 0})
    sessions = []
    async for doc in cursor:
        sessions.append(doc.get("session_id"))
    return sessions


async def discover_user_ids(app_db, ce_db) -> list[str]:
    """
    Query multiple collections to discover distinct user_ids present in MongoDB.
    Returns a sorted list of unique user IDs.
    """
    user_ids = set()

    # Collections in the application DB that have a user_id field
    app_collections_with_user_id = [
        "agent_director_state",
        CAREER_READINESS_COLLECTION,
    ]
    tasks = []
    for col_name in app_collections_with_user_id:
        tasks.append(app_db[col_name].distinct("user_id"))

    if ce_db is not None:
        tasks.append(ce_db[CAREER_EXPLORER_COLLECTION].distinct("user_id"))

    results = await asyncio.gather(*tasks, return_exceptions=True)
    for result in results:
        if isinstance(result, BaseException):
            continue
        user_ids.update(uid for uid in result if uid)  # type: ignore[union-attr]

    return sorted(user_ids)


def prompt_user_selection(user_ids: list[str]) -> str:
    """
    Present a numbered menu of user IDs and let the user pick one.
    If only one user exists, auto-select it.
    """
    if len(user_ids) == 1:
        print(f"Auto-selected the only available user: {user_ids[0]}")
        return user_ids[0]

    print("\nAvailable users:")
    for i, uid in enumerate(user_ids, start=1):
        print(f"  {i}. {uid}")

    while True:
        try:
            choice = input(f"\nSelect a user [1-{len(user_ids)}]: ").strip()
            index = int(choice) - 1
            if 0 <= index < len(user_ids):
                return user_ids[index]
            print(f"Please enter a number between 1 and {len(user_ids)}.")
        except (ValueError, EOFError):
            print(f"Please enter a number between 1 and {len(user_ids)}.")


async def main():
    parser = argparse.ArgumentParser(
        description="Reset conversation state for local development.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--user-id", required=False, help="The user ID (Firebase UID). If omitted, pick interactively.")
    parser.add_argument("--session-id", type=int, help="Session ID for skills & interest conversation")
    parser.add_argument("--all", action="store_true", help="Reset ALL conversation types")
    parser.add_argument("--skills", action="store_true", help="Reset skills & interest conversation (requires --session-id)")
    parser.add_argument("--career-readiness", action="store_true", help="Reset career readiness conversations")
    parser.add_argument("--career-explorer", action="store_true", help="Reset career explorer conversation")
    parser.add_argument("--list-sessions", action="store_true", help="List available session IDs")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be deleted without actually deleting")

    args = parser.parse_args()

    # Load .env from backend directory
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv(os.path.join(backend_dir, ".env"))

    app_uri = os.getenv("APPLICATION_MONGODB_URI")
    app_db_name = os.getenv("APPLICATION_DATABASE_NAME")
    ce_uri = os.getenv("CAREER_EXPLORER_MONGODB_URI")
    ce_db_name = os.getenv("CAREER_EXPLORER_DATABASE_NAME")

    if not app_uri or not app_db_name:
        print("ERROR: APPLICATION_MONGODB_URI and APPLICATION_DATABASE_NAME must be set in .env")
        sys.exit(1)

    # Determine what to reset
    do_skills = args.all or args.skills
    do_career_readiness = args.all or args.career_readiness
    do_career_explorer = args.all or args.career_explorer

    if not any([do_skills, do_career_readiness, do_career_explorer, args.list_sessions]):
        print("ERROR: Specify at least one of: --all, --skills, --career-readiness, --career-explorer, --list-sessions")
        sys.exit(1)

    if do_skills and not args.session_id and not args.list_sessions:
        print("ERROR: --skills (or --all) requires --session-id. Use --list-sessions to find yours.")
        sys.exit(1)

    # Connect to MongoDB
    app_client = AsyncIOMotorClient(app_uri)
    app_db = app_client[app_db_name]

    ce_client = None
    ce_db = None
    if do_career_explorer or args.list_sessions or not args.user_id:
        if not ce_uri or not ce_db_name:
            if do_career_explorer or args.list_sessions:
                print("WARNING: CAREER_EXPLORER_MONGODB_URI/DATABASE_NAME not set, skipping career explorer")
            do_career_explorer = False
        else:
            ce_client = AsyncIOMotorClient(ce_uri)
            ce_db = ce_client[ce_db_name]

    # If --user-id was not provided, discover users from MongoDB and prompt
    if not args.user_id:
        user_ids = await discover_user_ids(app_db, ce_db)
        if not user_ids:
            print("ERROR: No users found in MongoDB. Cannot proceed without --user-id.")
            sys.exit(1)
        args.user_id = prompt_user_selection(user_ids)

    try:
        if args.list_sessions:
            sessions = await list_sessions(app_db)
            if sessions:
                print(f"Available session IDs: {sessions}")
            else:
                print("No sessions found in agent_director_state.")
            return

        if args.dry_run:
            print("DRY RUN — no data will be deleted\n")

        total_deleted = 0

        if do_skills:
            if args.dry_run:
                print(f"Would delete skills & interest state for session_id={args.session_id}")
                print(f"  Collections: {', '.join(SKILLS_COLLECTIONS)}")
            else:
                count = await reset_skills(app_db, args.session_id)
                total_deleted += count
                print(f"Skills & Interest: deleted {count} documents (session_id={args.session_id})")

        if do_career_readiness:
            if args.dry_run:
                print(f"Would delete career readiness conversations for user_id={args.user_id}")
                print(f"  Collection: {CAREER_READINESS_COLLECTION}")
                await preview_conversation(app_db, CAREER_READINESS_COLLECTION, {"user_id": args.user_id})
            else:
                count = await reset_career_readiness(app_db, args.user_id)
                total_deleted += count
                print(f"Career Readiness: deleted {count} conversations (user_id={args.user_id})")

        if do_career_explorer and ce_db is not None:
            if args.dry_run:
                print(f"Would delete career explorer conversation for user_id={args.user_id}")
                print(f"  Collection: {CAREER_EXPLORER_COLLECTION}")
                await preview_conversation(ce_db, CAREER_EXPLORER_COLLECTION, {"user_id": args.user_id})
            else:
                count = await reset_career_explorer(ce_db, args.user_id)
                total_deleted += count
                print(f"Career Explorer: deleted {count} conversations (user_id={args.user_id})")

        if not args.dry_run:
            print(f"\nTotal: {total_deleted} documents deleted")

    finally:
        app_client.close()
        if ce_client:
            ce_client.close()


if __name__ == "__main__":
    asyncio.run(main())
