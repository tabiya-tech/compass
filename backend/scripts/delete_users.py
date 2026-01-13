import os
import asyncio
import json
from dataclasses import dataclass
from dotenv import load_dotenv
load_dotenv()

from motor.motor_asyncio import AsyncIOMotorCollection
import firebase_admin
from firebase_admin import credentials, auth
from datetime import datetime, timedelta
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.server_dependencies.database_collections import Collections


@dataclass
class Arguments:
    dry_run: bool
    inactivity_threshold: timedelta


# List anonymous users in batches
def _list_anonymous_users(inactivity_threshold: timedelta):
    now = datetime.utcnow()
    _users_found = []
    results = auth.list_users(page_token=None)
    while True:
        for user in results.users:
            if is_anonymous_user(user):
                last_sign_in_timestamp = user.user_metadata.last_sign_in_timestamp
                # Check if the user has a last sign-in time and if it exceeds the inactivity threshold
                if last_sign_in_timestamp:
                    last_sign_in_time = datetime.utcfromtimestamp(last_sign_in_timestamp / 1000)
                    if now - last_sign_in_time > inactivity_threshold:
                        _users_found.append(user.uid)

        # If there are more users to retrieve, continue with the next page
        if results.next_page_token:
            results = auth.list_users(page_token=results.next_page_token)
        else:
            break

    return _users_found


# List all users in batches
def _list_all_users():
    _users_found = []
    results = auth.list_users(page_token=None)
    while True:
        for user in results.users:
            _users_found.append(user.uid)
        # If there are more users to retrieve, continue with the next page
        if results.next_page_token:
            results = auth.list_users(page_token=results.next_page_token)
        else:
            break

    return _users_found


async def delete_anonymous_users(*, users_collection: AsyncIOMotorCollection, inactivity_threshold: timedelta, dry_run: bool = True):
    # Start listing users
    users_to_delete = _list_anonymous_users(inactivity_threshold)

    print(f'Found {len(users_to_delete)} inactive users.')

    # Delete users in batches (Firebase allows deleting up to 1000 users at a time)
    batch_size = 100
    deleted_users = 0
    for i in range(0, len(users_to_delete), batch_size):
        batch = users_to_delete[i:i + batch_size]
        if dry_run:
            print(f'Dry run: Would delete {len(batch)} users: {json.dumps(batch)}')
            deleted_users += len(batch)
        else:
            delete_users_result = auth.delete_users(batch)
            print(f'Successfully deleted {delete_users_result.success_count} users: {json.dumps(batch)}')
            # Delete corresponding users from MongoDB
            result = await users_collection.delete_many({"user_id": {"$in": batch}})
            print(f'Successfully deleted {result.deleted_count} users from MongoDB.')
            deleted_users += delete_users_result.success_count
    return deleted_users


async def delete_users_from_db(*, users_collection: AsyncIOMotorCollection, dry_run: bool = True):
    # delete all users from MongoDB that are not in Firebase
    all_users_in_firebase = _list_all_users()

    # get all user ids in MongoDB
    all_users_in_mongo = await users_collection.distinct("user_id")

    # get the users to delete
    users_to_delete = list(set(all_users_in_mongo) - set(all_users_in_firebase))

    # Delete users in batches for MongoDB
    batch_size = 100
    deleted_users = 0
    for i in range(0, len(users_to_delete), batch_size):
        batch = users_to_delete[i:i + batch_size]
        if dry_run:
            print(f'Dry run: Would delete {len(batch)} users: {json.dumps(batch)}')
            deleted_users += len(batch)
        else:
            # Delete corresponding users from MongoDB
            result = await users_collection.delete_many({"user_id": {"$in": batch}})
            print(f'Successfully deleted {result.deleted_count} users from MongoDB: {json.dumps(batch)}')
            deleted_users += result.deleted_count
    return deleted_users


def is_anonymous_user(user: auth.UserRecord) -> bool:
    return user.provider_id == "firebase" and len(user.provider_data) == 0


async def main(arguments: Arguments):
    try:
        # Initialize Firebase Admin SDK
        path_to_google_credentials = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        cred = credentials.Certificate(path_to_google_credentials)
        firebase_admin.initialize_app(cred)
        # Get a database reference to our users
        application_db = await CompassDBProvider.get_application_db()
        users_collection = application_db.get_collection(Collections.USER_PREFERENCES)

        # Delete anonymous users
        print(f"Deleting anonymous inactive users.")
        deleted_users = await delete_anonymous_users(users_collection=users_collection, inactivity_threshold=arguments.inactivity_threshold,
                                                     dry_run=arguments.dry_run)
        print(
            f"{'Dry run: ' if arguments.dry_run else ''}{deleted_users} Anonymous users {'would be ' if arguments.dry_run else ''}deleted successfully from both Firebase and MongoDB.")
        print("")
        print(f"Deleting users from MongoDB that are not in Firebase.")
        # Delete users from MongoDB that are not in Firebase
        deleted_users = await delete_users_from_db(users_collection=users_collection, dry_run=arguments.dry_run)
        print(
            f"{'Dry run: ' if arguments.dry_run else ''}{deleted_users} users {'would be ' if arguments.dry_run else ''}deleted successfully from MongoDB that are not in Firebase.")
    except Exception as e:
        print(f"Error deleting users: {e}")


# Set the threshold for inactivity (30 days)
DEFAULT_INACTIVITY_THRESHOLD = timedelta(hours=6)
DEFAULT_DRY_RUN = True


# Read command line arguments
# read days, hours, minutes, seconds in the format --inactivity-threshold 1d 2h 3m 4s
def inactivity_threshold_parser(s: list[str]) -> timedelta:
    # Parse the input string
    days = hours = minutes = seconds = 0
    for item in s:
        if item[-1] == 'd':
            days = int(item[:-1])
        elif item[-1] == 'h':
            hours = int(item[:-1])
        elif item[-1] == 'm':
            minutes = int(item[:-1])
        elif item[-1] == 's':
            seconds = int(item[:-1])
        else:
            raise ValueError(f"Invalid time unit: {item[-1]}")

    return timedelta(days=days, hours=hours, minutes=minutes, seconds=seconds)


def _parse_args() -> Arguments:
    import argparse
    parser = argparse.ArgumentParser(description='Delete inactive anonymous users from Firebase and MongoDB.')
    parser.add_argument('--dry-run', action='store_true', help='Run the script in dry-run mode.')

    parser.add_argument('--inactivity-threshold',
                        required=True,
                        type=str,
                        metavar='DAYS HOURS MINUTES SECONDS',
                        nargs='+',
                        help=(
                            'The threshold for inactivity specified as four separate integers '
                            'representing days, hours, minutes, and seconds respectively. '
                            'Example: --inactivity-threshold 1d 2h 3m 4s (for 1 day, 2 hours, 3 minutes, and 4 seconds of inactivity)'
                        ))
    _result = parser.parse_args()
    result = Arguments(
        dry_run=_result.dry_run,
        inactivity_threshold=inactivity_threshold_parser(_result.inactivity_threshold) if _result.inactivity_threshold else DEFAULT_INACTIVITY_THRESHOLD
    )
    return result


if __name__ == '__main__':
    args = _parse_args()
    asyncio.run(main(args))
