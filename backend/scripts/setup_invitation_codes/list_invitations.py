#!/usr/bin/env python3

import asyncio
import logging
import os
import argparse
from datetime import datetime
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env from backend directory
backend_dir = Path(__file__).parent.parent.parent
load_dotenv(backend_dir / ".env")

logger = logging.getLogger(__name__)


class ScriptSettings(BaseSettings):
    mongodb_uri: str = ""
    db_name: str = "compass-application-dev-brujula"

    class Config:
        env_prefix = "INVITATION_CODES_"
        
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Fallback to APPLICATION_MONGODB_URI if INVITATION_CODES_MONGODB_URI not set
        if not self.mongodb_uri:
            self.mongodb_uri = os.getenv("APPLICATION_MONGODB_URI", "")


async def list_invitations(mongo_uri: str, db_name: str):
    client = AsyncIOMotorClient(mongo_uri, tlsAllowInvalidCertificates=True)
    si = await client.server_info()
    db = client.get_database(db_name)
    collection = db.get_collection("user_invitations")

    host, port = client.address
    print(f"Connected to {db_name} at {host}:{port} version:{si.get('version', 'Unknown')}\n")

    cursor = collection.find({})
    now = datetime.now()
    
    print("=" * 100)
    print(f"{'Code':<40} {'Type':<10} {'Valid Until':<25} {'Usage':<20} {'Status':<10}")
    print("=" * 100)
    
    async for doc in cursor:
        code = doc.get("invitation_code", "N/A")
        inv_type = doc.get("invitation_type", "N/A")
        valid_until = doc.get("valid_until")
        remaining = doc.get("remaining_usage", 0)
        allowed = doc.get("allowed_usage", 0)
        spd_req = doc.get("sensitive_personal_data_requirement", "N/A")
        
        valid_until_str = valid_until.strftime("%Y-%m-%d %H:%M:%S") if valid_until else "N/A"
        usage_str = f"{remaining}/{allowed}"
        
        # Check if expired
        status = "EXPIRED" if valid_until and valid_until < now else "VALID"
        
        print(f"{code:<40} {inv_type:<10} {valid_until_str:<25} {usage_str:<20} {status:<10}")
        print(f"  └─ SPD Requirement: {spd_req}")
        print()
    
    print("=" * 100)
    client.close()


async def delete_invitation(mongo_uri: str, db_name: str, invitation_code: str):
    client = AsyncIOMotorClient(mongo_uri, tlsAllowInvalidCertificates=True)
    si = await client.server_info()
    db = client.get_database(db_name)
    collection = db.get_collection("user_invitations")

    host, port = client.address
    print(f"Connected to {db_name} at {host}:{port} version:{si.get('version', 'Unknown')}\n")

    # Find the invitation first to show what we're deleting
    invitation = await collection.find_one({"invitation_code": invitation_code})
    
    if not invitation:
        print(f"❌ Invitation code '{invitation_code}' not found.")
        client.close()
        return
    
    # Show what we're about to delete
    print(f"Found invitation code: {invitation_code}")
    print(f"  Type: {invitation.get('invitation_type', 'N/A')}")
    print(f"  Valid Until: {invitation.get('valid_until', 'N/A')}")
    print(f"  Usage: {invitation.get('remaining_usage', 0)}/{invitation.get('allowed_usage', 0)}")
    print()
    
    # Delete
    result = await collection.delete_one({"invitation_code": invitation_code})
    
    if result.deleted_count > 0:
        print(f"✅ Successfully deleted invitation code: {invitation_code}")
    else:
        print(f"❌ Failed to delete invitation code: {invitation_code}")
    
    client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="List or delete invitation codes from MongoDB"
    )
    parser.add_argument(
        "--delete",
        type=str,
        help="Delete the invitation code with the specified code",
        metavar="CODE"
    )
    
    args = parser.parse_args()
    settings = ScriptSettings()  # type: ignore
    
    if args.delete:
        asyncio.run(delete_invitation(settings.mongodb_uri, settings.db_name, args.delete))
    else:
        asyncio.run(list_invitations(settings.mongodb_uri, settings.db_name))
