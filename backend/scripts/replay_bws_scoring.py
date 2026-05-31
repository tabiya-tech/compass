#!/usr/bin/env python3
"""
Replay BWS scoring on real production sessions.

Pulls completed BWS sessions from the preference_elicitation_agent_state collection,
re-runs both the old count-based scorer and the new HB scorer on each session's raw
responses, and prints a side-by-side comparison.

Use this before deploying the BWS fix to:
  1. Confirm HB ranks items the user actually preferred higher than the count ranking did,
  2. Spot items that were "seen but not chosen" — present in HB output, absent from counts,
  3. Sanity-check the magnitude shift (HB posterior means vs count integers) that downstream
     scoring will now see in `bws_scores`.

Read-only — never writes to the database.

Usage:
  poetry run python scripts/replay_bws_scoring.py --limit 5
  poetry run python scripts/replay_bws_scoring.py --session-id 8842113
"""
import argparse
import asyncio
import logging
import sys
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic_settings import BaseSettings

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.agent.preference_elicitation_agent import bws_utils
from app.agent.preference_elicitation_agent.bws_hb import run_hb_bws
from app.server_dependencies.database_collections import Collections

logging.basicConfig(level=logging.WARNING, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


class ScriptSettings(BaseSettings):
    application_mongodb_uri: str = ""
    application_database_name: str = ""

    class Config:
        extra = "ignore"


def _format_score(v: float) -> str:
    return f"{v:+.2f}"


def _render_session(session_id: int, bws_responses: list[dict], wa_labels: dict[str, str]) -> None:
    print("=" * 88)
    print(f"SESSION {session_id}  —  {len(bws_responses)} BWS responses")
    print("=" * 88)

    # Old: count-based scoring (sparse — only items ever picked best/worst get an entry)
    count_scores = bws_utils.compute_bws_scores(bws_responses)
    count_ranked = sorted(count_scores.items(), key=lambda kv: kv[1], reverse=True)

    # New: HB scoring (full posterior over every item in the master WA list)
    all_wa_ids = list(wa_labels.keys())
    hb_result = run_hb_bws(bws_responses, all_wa_ids, k=10)
    hb_means = {item.wa_id: item.mean for item in hb_result.items}

    # Identify items that appeared as alts but were never picked best/worst
    seen_ids = {a for resp in bws_responses for a in resp.get("alts", [])}
    picked_ids = set(count_scores.keys())
    seen_only = seen_ids - picked_ids

    # Side-by-side top 10
    print(f"\nTop 10 — COUNT ranking ({len(count_scores)} items scored)         "
          f"|  Top 10 — HB ranking ({len(hb_result.items)} items scored, converged={hb_result.converged})")
    print("-" * 88)
    for i in range(10):
        left = "—"
        if i < len(count_ranked):
            wid, score = count_ranked[i]
            left = f"{i+1:>2}. {_format_score(score)}  {wa_labels.get(wid, wid)[:36]:36s}"
        right = "—"
        if i < len(hb_result.items):
            item = hb_result.items[i]
            right = f"{i+1:>2}. {_format_score(item.mean)}  {wa_labels.get(item.wa_id, item.wa_id)[:36]:36s}"
        print(f"  {left:60s} |  {right}")

    # The whole point of the fix: surface what count-based scoring dropped
    print(f"\nItems seen but never picked best/worst (silently dropped by old scorer): {len(seen_only)}")
    if seen_only:
        # Show their HB ranks so you can see the count scorer was losing actual signal
        seen_only_with_rank = sorted(
            [(wid, hb_means.get(wid, 0.0)) for wid in seen_only],
            key=lambda kv: kv[1], reverse=True,
        )
        for wid, mean in seen_only_with_rank[:5]:
            rank = next((it.rank for it in hb_result.items if it.wa_id == wid), None)
            print(f"  HB rank {rank:>2}, mean {_format_score(mean)}  {wa_labels.get(wid, wid)}")
        if len(seen_only) > 5:
            print(f"  … and {len(seen_only) - 5} more")

    # Magnitude shift: what downstream scoring will see in `bws_scores`
    if count_scores and hb_means:
        c_lo, c_hi = min(count_scores.values()), max(count_scores.values())
        h_lo, h_hi = min(hb_means.values()), max(hb_means.values())
        print(f"\nMagnitude shift in bws_scores values fed to matching service:")
        print(f"  Old (counts):    [{_format_score(c_lo)}, {_format_score(c_hi)}]")
        print(f"  New (HB means):  [{_format_score(h_lo)}, {_format_score(h_hi)}]")

    print()


async def replay(mongo_uri: str, db_name: str, session_id: int | None, limit: int) -> None:
    client = AsyncIOMotorClient(mongo_uri, tlsAllowInvalidCertificates=True)
    await client.server_info()
    db = client.get_database(db_name)
    coll = db.get_collection(Collections.PREFERENCE_ELICITATION_AGENT_STATE)

    query: dict = {"bws_phase_complete": True}
    if session_id is not None:
        query = {"session_id": session_id}

    cursor = coll.find(query).sort("_id", -1).limit(limit)
    docs = await cursor.to_list(length=limit)

    if not docs:
        print(f"No matching sessions found (query={query}).")
        client.close()
        return

    wa_labels = bws_utils.load_wa_labels()
    for doc in docs:
        responses = list(doc.get("bws_responses") or [])
        if not responses:
            print(f"Skipping session {doc.get('session_id')} — no bws_responses.")
            continue
        _render_session(doc.get("session_id"), responses, wa_labels)

    client.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Replay BWS scoring on real sessions and compare count-based vs HB rankings.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--limit", type=int, default=5, help="Most recent N completed BWS sessions (default 5)")
    parser.add_argument("--session-id", type=int, default=None, help="Replay one specific session_id")
    args = parser.parse_args()

    settings = ScriptSettings()
    if not settings.application_mongodb_uri or not settings.application_database_name:
        sys.exit("Set APPLICATION_MONGODB_URI and APPLICATION_DATABASE_NAME in .env")

    asyncio.run(replay(
        settings.application_mongodb_uri,
        settings.application_database_name,
        args.session_id,
        args.limit,
    ))


if __name__ == "__main__":
    main()
