"""
This module contains tests for the types module, specifically testing the validation behavior
of the SensitivePersonalData model.
"""

import pytest
from datetime import datetime, timezone
from pydantic import ValidationError

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
        """Test that a model with sensitive data and skipped=False is valid"""
        # GIVEN sensitive personal data and skipped=False
        given_user_id = get_random_printable_string(10)
        given_created_at = datetime.now(timezone.utc)
        given_sensitive_data = _get_encrypted_sensitive_personal_data()
        given_skipped = False

        # WHEN the model is constructed
        actual_model = SensitivePersonalData(
            user_id=given_user_id,
            created_at=given_created_at,
            sensitive_personal_data=given_sensitive_data,
            sensitive_personal_data_skipped=given_skipped
        )

        # THEN the model should be created successfully
        assert actual_model.user_id == given_user_id
        assert actual_model.created_at == given_created_at
        assert actual_model.sensitive_personal_data == given_sensitive_data
        assert actual_model.sensitive_personal_data_skipped == given_skipped

    def test_valid_when_skipped(self):
        """Test that a model with no sensitive data and skipped=True is valid"""
        # GIVEN no sensitive data and skipped=True
        given_user_id = get_random_printable_string(10)
        given_created_at = datetime.now(timezone.utc)
        given_sensitive_data = None
        given_skipped = True

        # WHEN the model is constructed
        actual_model = SensitivePersonalData(
            user_id=given_user_id,
            created_at=given_created_at,
            sensitive_personal_data=given_sensitive_data,
            sensitive_personal_data_skipped=given_skipped
        )

        # THEN the model should be created successfully
        assert actual_model.user_id == given_user_id
        assert actual_model.created_at == given_created_at
        assert actual_model.sensitive_personal_data is None
        assert actual_model.sensitive_personal_data_skipped is True

    def test_invalid_when_data_none_and_not_skipped(self):
        """Test that a model with no sensitive data and skipped=False is invalid"""
        # GIVEN no sensitive data and skipped=False
        given_user_id = get_random_printable_string(10)
        given_created_at = datetime.now(timezone.utc)
        given_sensitive_data = None
        given_skipped = False

        # WHEN attempting to construct the model
        # THEN a ValidationError should be raised
        with pytest.raises(ValidationError) as actual_error:
            SensitivePersonalData(
                user_id=given_user_id,
                created_at=given_created_at,
                sensitive_personal_data=given_sensitive_data,
                sensitive_personal_data_skipped=given_skipped
            )

        # AND the error message should indicate the validation failure
        assert "sensitive_personal_data cannot be None without setting sensitive_personal_data_skipped to True" in str(actual_error.value)

    def test_invalid_when_data_exists_and_skipped(self):
        """Test that a model with sensitive data and skipped=True is invalid"""
        # GIVEN sensitive data and skipped=True
        given_user_id = get_random_printable_string(10)
        given_created_at = datetime.now(timezone.utc)
        given_sensitive_data = _get_encrypted_sensitive_personal_data()
        given_skipped = True

        # WHEN attempting to construct the model
        # THEN a ValidationError should be raised
        with pytest.raises(ValidationError) as actual_error:
            SensitivePersonalData(
                user_id=given_user_id,
                created_at=given_created_at,
                sensitive_personal_data=given_sensitive_data,
                sensitive_personal_data_skipped=given_skipped
            )

        # AND the error message should indicate the validation failure
        assert "sensitive_personal_data_skipped cannot be True when sensitive_personal_data is provided" in str(actual_error.value) 