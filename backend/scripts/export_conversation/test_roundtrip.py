import json
import os.path
import shutil
from typing import Awaitable

import pytest
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.users.repositories import UserPreferenceRepository
from app.users.sensitive_personal_data.types import SensitivePersonalDataRequirement
from app.users.types import UserPreferences
from common_libs.test_utilities import get_random_user_id
from common_libs.test_utilities.setup_env_vars import setup_env_vars
from scripts.export_conversation.constants import SCRIPT_DIR

from scripts.export_conversation.import_script import import_conversation
from scripts.export_conversation.export_script import export_conversations


def _setup_test_conversation(session_id: int, output_directory: str):
    with open(os.path.join(SCRIPT_DIR, "sample_conversation.json"),  'r', encoding='utf-8') as f:
        given_sample_json_file_content = json.load(f)

    json_store_directory = os.path.join(output_directory, str(session_id))
    os.makedirs(json_store_directory, exist_ok=True)

    with open(os.path.join(json_store_directory, "state.json"), 'w', encoding='utf-8') as f:
        json.dump(given_sample_json_file_content, f, indent=2)


def _compare_jsons(output_directory: str, first_session_id: int, second_json_id: int):
    first_session_file_dir = os.path.join(output_directory, str(first_session_id))
    os.makedirs(first_session_file_dir, exist_ok=True)

    with open(os.path.join(first_session_file_dir, "state.json"), 'r', encoding='utf-8') as f:
        first_json = json.load(f)

    second_session_file_dir = os.path.join(output_directory, str(second_json_id))
    os.makedirs(second_session_file_dir, exist_ok=True)
    with open(os.path.join(second_session_file_dir, "state.json"), 'r', encoding='utf-8') as f:
        second_json = json.load(f)

    return first_json == second_json


def _compare_markdowns(output_directory: str, first_session_id: int, second_session_id: int):
    first_session_file_dir = os.path.join(output_directory, str(first_session_id))
    os.makedirs(first_session_file_dir, exist_ok=True)

    with open(os.path.join(first_session_file_dir, "conversation.md"), 'r', encoding='utf-8') as f:
        first_md = f.read()

    second_session_file_dir = os.path.join(output_directory, str(second_session_id))
    os.makedirs(second_session_file_dir, exist_ok=True)
    with open(os.path.join(second_session_file_dir, "conversation.md"), 'r', encoding='utf-8') as f:
        second_md = f.read()

    return first_md == second_md


@pytest.fixture(scope="function")
async def get_user_preferences_repository(
        in_memory_application_database: Awaitable[AsyncIOMotorDatabase]) -> UserPreferenceRepository:
    application_db = await in_memory_application_database
    repository = UserPreferenceRepository(application_db)
    host, port = application_db.client.address

    setup_env_vars(
        env_vars=dict(
            # Export script.
            EXPORT_CONVERSATION_SOURCE_MONGODB_URI=f"mongodb://{host}:{port}",
            EXPORT_CONVERSATION_SOURCE_DATABASE_NAME=application_db.name,

            # Import script.
            IMPORT_CONVERSATION_SOURCE_MONGODB_URI=f"mongodb://{host}:{port}",
            IMPORT_CONVERSATION_SOURCE_DATABASE_NAME=application_db.name,
            IMPORT_CONVERSATION_TARGET_MONGODB_URI=f"mongodb://{host}:{port}",
            IMPORT_CONVERSATION_TARGET_DATABASE_NAME=application_db.name
        )
    )

    return repository


class TestExportConversationsRoundtrip:
    @pytest.mark.asyncio
    async def test_import_and_export_scripts(self,
                                             get_user_preferences_repository: Awaitable[UserPreferenceRepository]):

        user_preferences_repository = await get_user_preferences_repository
        given_output_directory = os.path.join(SCRIPT_DIR, "_tmp", "_test_roundtrip")
        os.makedirs(given_output_directory, exist_ok=True)

        # Phase 1: Importing
        # GIVEN sample JSON Conversation as given_json.
        given_first_session_id = 1
        _setup_test_conversation(given_first_session_id, given_output_directory)

        # AND given some user with preferences.
        given_user_id = get_random_user_id()
        await user_preferences_repository.insert_user_preference(given_user_id, UserPreferences(
            sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_AVAILABLE
        ))

        # AND given sample conversation is imported in the database.
        successfully_imported = await import_conversation(
            source_session_id=given_first_session_id,
            source_type="JSON",
            source_directory=given_output_directory,
            target_user_id=given_user_id
        )

        # AND the conversation is successfully imported
        assert successfully_imported

        new_user_preferences = await user_preferences_repository.get_user_preference_by_user_id(user_id=given_user_id)
        # GUARD user_preferences.sessions.length should be only one
        assert len(new_user_preferences.sessions) == 1

        given_imported_import_session_id = new_user_preferences.sessions[0]

        # AND the imported conversation is imported for the second time
        successfully_imported_2 = await import_conversation(
            source_session_id=given_imported_import_session_id,
            source_type="DB",
            source_directory=given_output_directory,
            target_user_id=given_user_id
        )

        # AND the conversation is successfully for the second time.
        assert successfully_imported_2

        new_user_preferences = await user_preferences_repository.get_user_preference_by_user_id(user_id=given_user_id)
        # GUARD user_preferences.sessions.length should be now two
        assert len(new_user_preferences.sessions) == 2

        # AND the second conversation is exported from first JSON to md.
        await export_conversations(
            session_ids=[given_first_session_id],
            source_type="JSON",
            target_type="MD",
            output_directory=given_output_directory,
            queue_size=1
        )

        # Phase 2: Exporting.
        # AND the 2nd imported conversation is exported into JSON
        await export_conversations(
            session_ids=new_user_preferences.sessions,
            source_type="DB",
            target_type="JSON",
            output_directory=given_output_directory,
            queue_size=1
        )

        # AND the 2nd imported conversation is exported into markdown
        await export_conversations(
            session_ids=new_user_preferences.sessions,
            source_type="DB",
            target_type="MD",
            output_directory=given_output_directory,
            queue_size=1
        )

        # Phase 3: assertions

        assert new_user_preferences.sessions[0] != new_user_preferences.sessions[1]
        assert given_first_session_id != new_user_preferences.sessions[1]

        # Assert given_json = exported_json
        _compare_jsons(given_output_directory, given_first_session_id, new_user_preferences.sessions[1])

        # AND the first imported/exported json should match the second imported/exported json.
        _compare_jsons(given_output_directory, new_user_preferences.sessions[0], new_user_preferences.sessions[1])

        # Assert exported_md = exported_md_1
        _compare_markdowns(given_output_directory, given_first_session_id, new_user_preferences.sessions[1])

        # AND the first imported/exported md should match the second imported/exported md.
        _compare_markdowns(given_output_directory, new_user_preferences.sessions[0], new_user_preferences.sessions[1])

        # clean up created files
        shutil.rmtree(given_output_directory)
