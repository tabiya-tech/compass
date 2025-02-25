"""
This module contains the types used for storing sensitive personal data.
"""

from enum import Enum
from typing import Union, Mapping
from datetime import datetime, timezone
from pydantic import BaseModel, Field, field_validator, field_serializer, model_validator


class SensitivePersonalDataRequirement(Enum):
    """
    Represents the requirement of the sensitive data
    """

    REQUIRED = "REQUIRED"
    NOT_REQUIRED = "NOT_REQUIRED"
    NOT_AVAILABLE = "NOT_AVAILABLE"


class EncryptedSensitivePersonalData(BaseModel):
    """
    Represents the encrypted sensitive personal data.
    """
    rsa_key_id: str = Field(
        description="The key ID of the RSA key used to encrypt the AES key",
        examples=["key_123"],
        # RSA key id should not exceed 256 characters
        max_length=256
    )

    aes_encryption_key: str = Field(
        description="The AES key used to encrypt/decrypt the sensitive user data"
                    "It is encrypted with RSA and Base64-encoded",
        examples=["ZGFzZGE="],
        # Max field length is set to 1000 characters for the following reasons:
        # - We use a 256-bit AES key (32 bytes) encrypted with a 4096-bit RSA key.
        # - RSA encryption results in a block size of 512 bytes (4096 bits / 8).
        # - When Base64 encoded, the size becomes approximately 684 bytes ceil(512/3)*4).
        # - To allow for tolerance and stay within limits, we round up the max length to 1000 characters.
        max_length=1000
    )

    aes_encrypted_data: str = Field(
        description="The AES encrypted user-sensitive data combined with the IV and the authentication tag. The data is Base64 encoded",
        examples=["ZGFzZGFkZGFkw=="],
        # Max field size is set to 35,000 characters based on the following calculations:
        # - Assumes encryption of 15 fields, each with keys and values up to 256 characters long, so the sum is 256 * 2
        #   (e.g., "first_name": "foo:, "last_name": "bar", "gender" etc.).
        # - Each character is up to 3 bytes in UTF-8 (worst-case scenario), resulting in 256 * 2 * 3 = 1536 bytes per field.
        # - For 15 fields: 15 * 1536 = 23,131 bytes (JSON structure included).
        # - AES-GCM encryption adds a 16-byte tag and a 12-byte IV to the payload.
        # - Total encrypted payload size: 23,131 bytes + 16 bytes (tag) + 12 bytes (IV) = 23,159 bytes.
        # - Base64 encoding increases the size by ceil(23,159/3) * 4, resulting in approximately 30880 bytes.
        # - Adding tolerance for overhead, the max size is rounded to 35,000 characters for safety.
        max_length=35000
    )
    """
    The data are encrypted with AES and consist of three parts (IV, encrypted data, tag) which are concatenated and then Base64 encoded.
       - The first part, with a fixed length of 12 bytes (for AES-GCM), contains the initialization vector (IV).
           See frontend-new/src/sensitiveData/config/encryptionConfig.ts
       - The second part is the encrypted JSON representation of the user's sensitive data
       - The last part is the authentication tag which is 16 bytes long (for AES-GCM).       
    """


class CreateSensitivePersonalDataRequest(BaseModel):
    """
    Represents the request body for creating sensitive personal data.
    """
    sensitive_personal_data: EncryptedSensitivePersonalData | None = Field(
        description="The encrypted sensitive personal data. None if skipped.",
        default=None
    )

    class Config:
        """
        Pydantic configuration.
        """
        extra = "forbid"


class SensitivePersonalData(BaseModel):
    """
    The Sensitive personal data document in the database.
    """

    user_id: str = Field(description="The user id")
    created_at: datetime = Field(description="The date and time the database entry was created")
    sensitive_personal_data: EncryptedSensitivePersonalData | None = Field(
        description="The encrypted sensitive personal data. None if skipped.",
        default=None
    )

    # Serialize the creation_time datetime to ensure it's stored as UTC
    @field_serializer("created_at")
    def _serialize_creation_time(self, creation_time: datetime) -> str:
        return creation_time.isoformat()

    # Deserialize the creation_time datetime and ensure it's interpreted as UTC
    @classmethod
    @field_validator("created_at", mode='before')
    def _deserialize_creation_time(cls, value: Union[str, datetime]) -> datetime:
        if isinstance(value, str):
            dt = datetime.fromisoformat(value)
        else:
            dt = value
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

    @staticmethod
    def from_dict(_dict: Mapping[str, any]) -> "SensitivePersonalData":
        """
        Converts a dictionary to a `SensitivePersonalData` object.

        This method extracts fields from a provided dictionary, and initializes a
        `SensitivePersonalData` object with those values.

        :param _dict: A mapping from string keys to corresponding values,
                      representing the attributes of a `SensitivePersonalData` object.

        :return: An instance of `SensitivePersonalData` initialized from the
                 provided dictionary.
        """
        return SensitivePersonalData(
            user_id=str(_dict.get("user_id")),
            created_at=_dict.get("created_at"),
            sensitive_personal_data=_dict.get("sensitive_personal_data")
        )

    class Config:
        """
        Pydantic configuration for the SensitivePersonalData class.
        """
        extra = "forbid"
