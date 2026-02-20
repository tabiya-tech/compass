"""
Script to download the latest translations from the Google Sheet and automatically
update the frontend and backend JSON language files.
"""

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from google.oauth2 import service_account
from googleapiclient.discovery import build

from locale_registration import register_locales

# Configuration
load_dotenv()
GOOGLE_SHEETS_CREDENTIALS = os.getenv("GOOGLE_SHEETS_CREDENTIALS")
GOOGLE_SHEET_ID = os.getenv("GOOGLE_SHEET_ID")
SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

PLATFORM_MAPPINGS = {
    "Frontend": "frontend-new/src/i18n/locales/{locale}/translation.json",
    "Backend":  "backend/app/i18n/locales/{locale}/messages.json",
    "Feedback": "frontend-new/src/feedback/overallFeedback/feedbackForm/questions-{locale}.json",
}

def build_service(credentials_path: str):
    """Builds a Google Sheets service object."""
    creds = service_account.Credentials.from_service_account_file(
        credentials_path, scopes=SCOPES
    )
    return build("sheets", "v4", credentials=creds)

def fetch_rows(service, sheet_id: str, range_name: str = "A:ZZZ") -> list[list[str]]:
    """Fetches all rows from the specified spreadsheet range."""
    result = service.spreadsheets().values().get(
        spreadsheetId=sheet_id, range=range_name
    ).execute()
    return result.get("values", [])

def set_nested(d: dict, key_path: str, value):
    """Sets a value in a nested dictionary using a dot-notated key path."""
    parts = key_path.split(".")
    for part in parts[:-1]:
        if part not in d or not isinstance(d[part], dict):
            d[part] = {}
        d = d[part]
    # Format value: restore newlines and handle nulls
    d[parts[-1]] = value.replace("\\n", "\n") if isinstance(value, str) else value

def _get_translations_data(header: list[str], rows: list[list[str]], locales: list[str]) -> dict:
    """Groups spreadsheet rows by target (platform, locale)."""
    all_data = {}
    for row in rows[1:]:
        padded = row + [""] * (len(header) - len(row))
        platform, key_path = padded[0].strip(), padded[1].strip()

        if platform not in PLATFORM_MAPPINGS or not key_path:
            continue

        for i, locale in enumerate(locales):
            value = padded[2 + i]
            # If value is empty, use None so it becomes 'null' in JSON
            val_to_set = value if value != "" else None
            
            target = (platform, locale)
            all_data.setdefault(target, {})[key_path] = val_to_set
    return all_data

def _sync_dict(existing: dict, incoming: dict) -> dict:
    """Order-preserving sync of two nested dicts"""
    result: dict = {}

    for key, old_val in existing.items():
        if key not in incoming:
            continue
        new_val = incoming[key]
        if isinstance(old_val, dict) and isinstance(new_val, dict):
            result[key] = _sync_dict(old_val, new_val)
        else:
            result[key] = new_val

    for key, new_val in incoming.items():
        if key not in result:
            result[key] = new_val

    return result


def _write_json_files(root_dir: Path, all_data: dict):
    """Writes translation data to JSON files using an order-preserving sync"""
    for (platform, locale), updates in all_data.items():
        file_path = root_dir / PLATFORM_MAPPINGS[platform].format(locale=locale)
        file_path.parent.mkdir(parents=True, exist_ok=True)

        # Build the incoming dict from sheet data (dot-notation → nested)
        incoming: dict = {}
        for key, val in updates.items():
            set_nested(incoming, key, val)

        # Load an existing file (empty dict for new locales)
        existing: dict = {}
        if file_path.exists():
            try:
                existing = json.loads(file_path.read_text(encoding="utf-8") or "{}")
            except json.JSONDecodeError:
                pass

        synced = _sync_dict(existing, incoming)

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(synced, f, indent=2, ensure_ascii=False)
            f.write("\n")

def main():
    if not GOOGLE_SHEETS_CREDENTIALS or not GOOGLE_SHEET_ID:
        print("ERROR: GOOGLE_SHEETS_CREDENTIALS or GOOGLE_SHEET_ID not set in .env")
        sys.exit(1)

    root_dir = Path(__file__).resolve().parent.parent.parent
    service = build_service(GOOGLE_SHEETS_CREDENTIALS)
    rows = fetch_rows(service, GOOGLE_SHEET_ID)

    if not rows:
        print("ERROR: Sheet is empty.")
        sys.exit(1)

    header = rows[0]
    if len(header) < 3 or header[0] != "Platform" or header[1] != "Key":
        print("ERROR: Invalid header. Expected ['Platform', 'Key', <locale>, ...]")
        sys.exit(1)

    locales = header[2:]
    all_data = _get_translations_data(header, rows, locales)
    _write_json_files(root_dir, all_data)

    print(f"Import complete. Processed {len(all_data)} translation files.")
    
    # Auto-register any new locales found in the sheet
    new_locs = register_locales(root_dir, locales)
    if new_locs:
        print(f"Successfully registered {len(new_locs)} new languages: {', '.join(new_locs)}")

if __name__ == "__main__":
    main()
