"""
Onboard a batch of pilot users from a Google Form CSV export.

For each row the script:
  1. Creates a Firebase account (random password).
  2. Sends a password-reset link so the user can set their own password.
  3. Inserts a user_preferences document (accepted_tc=now, sensitive_personal_data_requirement=NOT_REQUIRED).
  4. Inserts a plain_personal_data document pre-filled from the form.
  5. Upserts a user_institution_assignment document (email → institution).
  6. Upserts the institution into pilot_whitelist (idempotent).

Because plain_personal_data is pre-populated, has_sensitive_personal_data resolves to
True on first login and the user goes straight to chat — no onboarding form needed.

Expected CSV columns (from the Evelyn Hone Google Form export):
    "A1. Full name"                          – required
    "A3. Personal email address"             – required  (used as Firebase email)
    "A4. What program or trade are you studying?"  – required
    "A4.1. If 'Other', please name your program (and ZQF level) below."  – optional
    "A6. Which year of your program are you in?"   – required

Usage:
    # Dry run — preview, no changes
    python onboard_pilot_users.py \\
        --institution-name "Evelyn Hone College" \\
        --institution-reg-no "EHC/001" \\
        --file form_responses.csv \\
        --tenant-id "YourTenantId" \\
        --project-id "your-gcp-project" \\
        --mongodb-uri "mongodb://127.0.0.1:27017/" \\
        --db-name "compass-application-dev" \\
        --dry-run

    # Live run (omit --dry-run)
    python onboard_pilot_users.py \\
        --institution-name "Evelyn Hone College" \\
        --institution-reg-no "EHC/001" \\
        --file form_responses.csv \\
        --tenant-id "YourTenantId" \\
        --project-id "your-gcp-project" \\
        --mongodb-uri "mongodb://127.0.0.1:27017/" \\
        --db-name "compass-application-dev"
"""

import argparse
import csv
import logging
import secrets
import string
import sys
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, tenant_mgt
from pymongo import MongoClient

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# ── Collection names (must match database_collections.py) ────────────────────
COLLECTION_USER_PREFERENCES = "user_preferences"
COLLECTION_PLAIN_PERSONAL_DATA = "plain_personal_data"
COLLECTION_USER_INSTITUTION_ASSIGNMENT = "user_institution_assignment"
COLLECTION_PILOT_WHITELIST = "pilot_whitelist"

# ── Form CSV column names ─────────────────────────────────────────────────────
COL_FULL_NAME = "A1. Full name"
COL_EMAIL = "A3. Personal email address"
COL_PROGRAMME = "A4. What program or trade are you studying?"
COL_PROGRAMME_OTHER = "A4.1. If 'Other', please name your program (and ZQF level) below."
COL_YEAR = "A6. Which year of your program are you in?"


@dataclass
class PilotUser:
    email: str
    full_name: str
    programme: str
    school_year: str
    first_name: str = field(init=False)
    last_name: str = field(init=False)

    def __post_init__(self):
        parts = self.full_name.strip().split(None, 1)
        self.first_name = parts[0] if parts else self.full_name
        self.last_name = parts[1] if len(parts) > 1 else ""


def _generate_password(length: int = 32) -> str:
    alphabet = string.ascii_letters + string.digits + string.punctuation
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _read_csv(path: str) -> list[PilotUser]:
    users: list[PilotUser] = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=2):  # row 1 = header
            email = row.get(COL_EMAIL, "").strip().lower()
            full_name = row.get(COL_FULL_NAME, "").strip()
            programme = row.get(COL_PROGRAMME, "").strip()
            # If programme is "Other", use the free-text field
            if programme.lower() == "other":
                programme = row.get(COL_PROGRAMME_OTHER, "").strip() or "Other"
            school_year = row.get(COL_YEAR, "").strip()

            if not email:
                logger.warning("Row %d: missing email — skipping", i)
                continue
            if not full_name:
                logger.warning("Row %d (%s): missing full name — skipping", i, email)
                continue

            users.append(PilotUser(
                email=email,
                full_name=full_name,
                programme=programme,
                school_year=school_year,
            ))
    return users


def _create_firebase_user(
    email: str, display_name: str, tenant_id: str, dry_run: bool
) -> str:
    if dry_run:
        logger.info("[DRY RUN] Would create Firebase user: %s (name=%s)", email, display_name)
        return f"dry-run-uid-{email}"

    auth_client = tenant_mgt.auth_for_tenant(tenant_id)
    password = _generate_password()
    try:
        user = auth_client.create_user(
            email=email,
            email_verified=True,
            password=password,
            display_name=display_name,
            disabled=False,
        )
        logger.info("Created Firebase user %s → uid=%s", email, user.uid)
        return user.uid
    except Exception as exc:
        if "EMAIL_EXISTS" in str(exc) or "email-already-exists" in str(exc).lower():
            logger.warning("Firebase user already exists for %s — reusing", email)
            existing = auth_client.get_user_by_email(email)
            return existing.uid
        raise


def _send_password_reset(email: str, tenant_id: str, dry_run: bool) -> None:
    if dry_run:
        logger.info("[DRY RUN] Would send password reset to: %s", email)
        return
    auth_client = tenant_mgt.auth_for_tenant(tenant_id)
    link = auth_client.generate_password_reset_link(email)
    logger.info("Password reset link for %s: %s", email, link)


def _insert_user_preferences(db, user_id: str, dry_run: bool) -> None:
    now = datetime.now(tz=timezone.utc)
    doc = {
        "user_id": user_id,
        "language": "en",
        "accepted_tc": now,
        "client_id": str(uuid.uuid4()),
        "sessions": [],
        "sensitive_personal_data_requirement": "NOT_REQUIRED",
        "experiments": {},
        "created_at": now,
    }
    if dry_run:
        logger.info("[DRY RUN] Would insert user_preferences for uid=%s", user_id)
        return
    result = db[COLLECTION_USER_PREFERENCES].update_one(
        {"user_id": user_id},
        {"$setOnInsert": doc},
        upsert=True,
    )
    if result.upserted_id:
        logger.info("Inserted user_preferences for uid=%s", user_id)
    else:
        logger.info("user_preferences already exists for uid=%s — skipped", user_id)


def _insert_plain_personal_data(
    db, user_id: str, user: PilotUser, institution_name: str, reg_no: Optional[str], dry_run: bool
) -> None:
    now = datetime.now(tz=timezone.utc)
    data = {
        "first_name": user.first_name,
        "last_name": user.last_name,
        "institution_name": institution_name,
        "programme_name": user.programme,
        "school_year": user.school_year,
    }
    if reg_no:
        data["reg_no"] = reg_no

    doc = {
        "user_id": user_id,
        "data": data,
        "created_at": now,
        "updated_at": now,
    }
    if dry_run:
        logger.info("[DRY RUN] Would insert plain_personal_data for uid=%s: %s", user_id, data)
        return
    result = db[COLLECTION_PLAIN_PERSONAL_DATA].update_one(
        {"user_id": user_id},
        {
            "$set": {"data": data, "updated_at": now},
            "$setOnInsert": {"user_id": user_id, "created_at": now},
        },
        upsert=True,
    )
    if result.upserted_id:
        logger.info("Inserted plain_personal_data for uid=%s", user_id)
    else:
        logger.info("Updated plain_personal_data for uid=%s", user_id)


def _upsert_assignment(
    db, user_id: str, institution_name: str, reg_no: Optional[str], dry_run: bool
) -> None:
    if dry_run:
        logger.info("[DRY RUN] Would upsert user_institution_assignment: uid=%s → %s", user_id, institution_name)
        return
    db[COLLECTION_USER_INSTITUTION_ASSIGNMENT].update_one(
        {"user_id": user_id},
        {"$set": {"user_id": user_id, "institution_name": institution_name, "reg_no": reg_no}},
        upsert=True,
    )
    logger.debug("Upserted institution assignment for uid=%s", user_id)


def _upsert_pilot_whitelist(
    db, institution_name: str, reg_no: Optional[str], dry_run: bool
) -> None:
    if dry_run:
        logger.info("[DRY RUN] Would upsert pilot_whitelist: %s (reg_no=%s)", institution_name, reg_no)
        return
    db[COLLECTION_PILOT_WHITELIST].update_one(
        {"institution_name": institution_name},
        {"$set": {"institution_name": institution_name, "reg_no": reg_no}},
        upsert=True,
    )
    logger.info("Upserted pilot_whitelist: %s", institution_name)


def run(args) -> None:
    if args.dry_run:
        logger.info("=" * 60)
        logger.info("DRY RUN — no changes will be made")
        logger.info("=" * 60)

    users = _read_csv(args.file)
    if not users:
        logger.error("No users found in %s", args.file)
        sys.exit(1)
    logger.info("Loaded %d user(s) from %s", len(users), args.file)

    mongo_client = MongoClient(args.mongodb_uri, tlsAllowInvalidCertificates=True)
    db = mongo_client[args.db_name]

    # Whitelist the institution once (idempotent)
    _upsert_pilot_whitelist(db, args.institution_name, args.institution_reg_no, args.dry_run)

    ok, failed = 0, 0
    for user in users:
        try:
            uid = _create_firebase_user(user.email, user.full_name, args.tenant_id, args.dry_run)
            _send_password_reset(user.email, args.tenant_id, args.dry_run)
            _insert_user_preferences(db, uid, args.dry_run)
            _insert_plain_personal_data(db, uid, user, args.institution_name, args.institution_reg_no, args.dry_run)
            _upsert_assignment(db, uid, args.institution_name, args.institution_reg_no, args.dry_run)
            ok += 1
        except Exception as exc:
            logger.error("Failed to process %s: %s", user.email, exc, exc_info=True)
            failed += 1

    logger.info("Done. Success: %d  Failed: %d", ok, failed)
    if args.dry_run:
        logger.info("=" * 60)
        logger.info("DRY RUN COMPLETE — re-run without --dry-run to apply")
        logger.info("=" * 60)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Onboard Evelyn Hone pilot users: create Firebase accounts and pre-fill personal data."
    )
    parser.add_argument("--institution-name", required=True)
    parser.add_argument("--institution-reg-no", required=False, default=None)
    parser.add_argument("--file", required=True, help="Path to the Google Form CSV export")
    parser.add_argument("--tenant-id", required=True, help="Firebase tenant ID")
    parser.add_argument("--project-id", required=True, help="GCP project ID")
    parser.add_argument("--mongodb-uri", required=True)
    parser.add_argument("--db-name", required=True)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, options={"projectId": args.project_id})
    run(args)


if __name__ == "__main__":
    main()
