"""
This module contains tests for the types module, specifically testing the validation behavior
of the SensitivePersonalData model.
"""

import pytest
from datetime import datetime, timezone

from app.users.sensitive_personal_data.types import SensitivePersonalData, EncryptedSensitivePersonalData
from common_libs.test_utilities.random_data import get_random_printable_string


def _get_encrypted_sensitive_personal_data() -> EncryptedSensitivePersonalData:
    """Helper function to create test encrypted data"""
    return EncryptedSensitivePersonalData(
        rsa_key_id=get_random_printable_string(20),
        aes_encryption_key=get_random_printable_string(10),
        aes_encrypted_data=get_random_printable_string(100)
    )


class TestSensitivePersonalDataValidation:
    """Tests for the SensitivePersonalData model validation"""

    def test_valid_with_sensitive_data(self):
        """Test that a model with sensitive data is valid"""
        # GIVEN sensitive personal data
        given_user_id = get_random_printable_string(10)
        given_created_at = datetime.now(timezone.utc)
        given_sensitive_data = _get_encrypted_sensitive_personal_data()

        # WHEN the model is constructed
        actual_model = SensitivePersonalData(
            user_id=given_user_id,
            created_at=given_created_at,
            sensitive_personal_data=given_sensitive_data
        )

        # THEN the model should be valid
        assert actual_model.user_id == given_user_id
        assert actual_model.created_at == given_created_at
        assert actual_model.sensitive_personal_data == given_sensitive_data

    def test_valid_when_skipped(self):
        """Test that a model with no sensitive data is valid"""
        # GIVEN no sensitive data
        given_user_id = get_random_printable_string(10)
        given_created_at = datetime.now(timezone.utc)
        given_sensitive_data = None

        # WHEN the model is constructed
        actual_model = SensitivePersonalData(
            user_id=given_user_id,
            created_at=given_created_at,
            sensitive_personal_data=given_sensitive_data
        )

        # THEN the model should be valid
        assert actual_model.user_id == given_user_id
        assert actual_model.created_at == given_created_at
        assert actual_model.sensitive_personal_data is None 