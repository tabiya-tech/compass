#!/usr/bin/env python3

import sys
import os

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Get the absolute path of the project root
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))

# Add the project root to the Python path, so that this script can import the necessary modules no matter where it is run from
if project_root not in sys.path:
    sys.path.insert(0, project_root)

"""
script to decrypt the sensitive personal data
"""

import base64
import argparse
import asyncio
import json
import logging

from datetime import datetime, timezone
from pydantic import BaseModel, field_validator, field_serializer
from typing import Optional, Final, Union

from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.asymmetric import padding as asymmetric_padding

from app.users.sensitive_personal_data.types import SensitivePersonalData
from app.users.sensitive_personal_data.repository import SensitivePersonalDataRepository

load_dotenv()

# Set up logging to use the module's file name
logger = logging.getLogger(os.path.basename(__file__))

IV_SIZE: Final[int] = 12  # The initialization vector size in bytes
TAG_LENGTH: Final[int] = 16  # 16 bytes, which is 128 bits
AES_KEY_LENGTH: Final[int] = 32  # 32 bytes, which is 256 bits


class DecryptedPersonalDataModel(BaseModel):
    user_id: str
    created_at: datetime

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

    class Config:
        extra = "allow"  # allow extra fields as the actual data fields may vary


def _extract_rsa_private_crypto_key(pem_key: bytes, password: Optional[bytes]) -> RSAPrivateKey:
    """
    Extracts the RSA private key from a PEM formatted string/bytes.
    """

    return serialization.load_pem_private_key(
        pem_key,
        password=password if password else None,
    )


def _rsa_decrypt_message(_private_key: RSAPrivateKey, encrypted_message: bytes) -> bytes:
    """
    Decrypts an RSA encrypted message using the private key.

    What happens:
        - decrypts the message using the private key
        - uses OAEP padding to decrypt the message with SHA256 as the hashing algorithm

    :param _private_key: The RSA private key used to decrypt the message
    :param encrypted_message: The encrypted message that needs to be decrypted
    :return:
    """

    plaintext = _private_key.decrypt(
        encrypted_message,

        asymmetric_padding.OAEP(
            mgf=asymmetric_padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )

    return plaintext


def _aes_decrypt_message(iv: bytes, aes_decryption_key: bytes, aes_encrypted_bytes: bytes) -> bytes:
    # the last TAG_LENGTH bytes from the encrypted data represent the authentication tag for the GCM
    tag = aes_encrypted_bytes[-TAG_LENGTH:]
    cipher = Cipher(algorithms.AES(aes_decryption_key), modes.GCM(initialization_vector=iv, tag=tag))
    decrypting_fn = cipher.decryptor()
    decrypted_message = decrypting_fn.update(aes_encrypted_bytes[:-TAG_LENGTH]) + decrypting_fn.finalize()
    return decrypted_message


async def _decrypt_sensitive_personal_data(_private_key: RSAPrivateKey, encrypted_personal_data: SensitivePersonalData) -> DecryptedPersonalDataModel:
    """
    Decrypts the sensitive personal data using the provided private key.

    What happens:
         - separates the encrypted data into the initialization vector and the encrypted text
         - decrypts the AES key using the RSA private key
         - decrypts the encrypted text using the AES key and the initialization vector

    :param _private_key: The RSA private key used to decrypt the sensitive personal data
    :param encrypted_personal_data: The encrypted sensitive personal data
    :return: The decrypted sensitive personal data
    """

    # Decrypt the message
    try:
        if encrypted_personal_data.sensitive_personal_data is None:
            return DecryptedPersonalDataModel(
                user_id=encrypted_personal_data.user_id,
                created_at=encrypted_personal_data.created_at,
                error="Sensitive personal data was skipped"
            )

        cyphertext = base64.b64decode(encrypted_personal_data.sensitive_personal_data.aes_encrypted_data)
        decryption_key = base64.b64decode(encrypted_personal_data.sensitive_personal_data.aes_encryption_key)

        cyphertext_array = [byte for byte in cyphertext]
        decryption_key_array = [byte for byte in decryption_key]

        # The first IV_SIZE bytes are the initialization vector
        aes_iv = cyphertext_array[:IV_SIZE]
        # The rest of the bytes are the encrypted text
        aes_encrypted_text = cyphertext_array[IV_SIZE:]

        aes_decryption_key = _rsa_decrypt_message(_private_key, bytes(decryption_key_array))
        personal_data = _aes_decrypt_message(bytes(aes_iv), bytes(aes_decryption_key), bytes(aes_encrypted_text))

        return DecryptedPersonalDataModel(
            user_id=encrypted_personal_data.user_id,
            created_at=encrypted_personal_data.created_at,
            **json.loads(personal_data.decode())
        )
    except Exception as e:
        logger.error(f"Error decrypting data for user {encrypted_personal_data.user_id}: {e}")
        return DecryptedPersonalDataModel(
            user_id=encrypted_personal_data.user_id,
            error="Error decrypting data: " + str(e),
            key_id=encrypted_personal_data.sensitive_personal_data.rsa_key_id if encrypted_personal_data.sensitive_personal_data else None,
            created_at=encrypted_personal_data.created_at
        )


async def decrypt_sensitive_data_from_database(*,
                                               private_key_pem: bytes,
                                               private_key_password: Optional[bytes],
                                               output_path: str,
                                               repository: SensitivePersonalDataRepository
                                               ):
    """
    Main function to decrypt the sensitive personal data.

    :param repository:  The repository to get the sensitive personal data from
    :param output_path: The path to the output file (JSON format)
    :param private_key_password: the password of the private key
    :param private_key_pem: The RSA private key in PEM format
    :return: None
    """

    # Load the private key
    private_key: RSAPrivateKey = _extract_rsa_private_crypto_key(private_key_pem, private_key_password)

    # stream the data from the database in chunks
    user_data = repository.stream(discard_skipped=True)
    decrypted_data = []

    logger.info("starting to decrypt the sensitive personal data")
    start_time = asyncio.get_event_loop().time()
    async for personal_data in user_data:
        decrypted_datum = await _decrypt_sensitive_personal_data(private_key, personal_data)
        decrypted_data.append(decrypted_datum)

    logger.info(f"decryption took {(asyncio.get_event_loop().time() - start_time):.2f} seconds to decrypt {len(decrypted_data)} records")

    # writing the decrypted data to a file
    with open(output_path, "w", encoding="UTF-8") as file:
        file.write(json.dumps([datum.model_dump() for datum in decrypted_data], ensure_ascii=False, indent=2))


async def _main():
    args = parser.parse_args()

    private_key_path = args.private_key_path
    _private_key_password: str = args.password

    # load the private key
    with open(private_key_path, "rb") as f:
        _private_key_pem = f.read()

    # create the output directory if it doesn't exist
    _output_path = args.output_path
    output_dir = os.path.dirname(_output_path)
    if not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    # connect to the database
    mongo_uri = os.getenv("DECRYPT_SCRIPT_USERDATA_MONGODB_URI")
    if mongo_uri is None:  # noqa
        raise ValueError("The userdata MongoDB URI is not set in the environment variables (DECRYPT_SCRIPT_USERDATA_MONGODB_URI)")

    database_name = os.getenv("DECRYPT_SCRIPT_USERDATA_DB_NAME")
    if database_name is None:  # noqa
        raise ValueError("The userdata MongoDB database name is not set in the environment variables (DECRYPT_SCRIPT_USERDATA_DB_NAME)")

    # Connect to MongoDB
    client = AsyncIOMotorClient(mongo_uri, tlsAllowInvalidCertificates=True)
    db = client.get_database(database_name)
    repository = SensitivePersonalDataRepository(db=db)

    # decrypt the data
    await decrypt_sensitive_data_from_database(
        private_key_pem=_private_key_pem,
        private_key_password=_private_key_password.encode() if _private_key_password else None,
        output_path=_output_path,
        repository=repository
    )


if __name__ == "__main__":
    if sys.version_info < (3, 11):
        sys.exit("This script requires Python 3.11 or higher.")

    parser = argparse.ArgumentParser(description="decrypt saved sensitive personal data",
                                     epilog="The following environment variables are required: DECRYPT_SCRIPT_USERDATA_MONGODB_URI, DECRYPT_SCRIPT_USERDATA_DB_NAME")

    parser.add_argument(
        '--private-key-path',
        type=str,
        required=True,
        help='Path to the PEM-format private key file (absolute or relative to the current working directory).',
        default=None
    )

    parser.add_argument(
        '--output-path',
        type=str,
        required=True,
        help='Path to the JSON output file (absolute or relative to the current working directory).',
        default=None
    )

    parser.add_argument(
        '--password',
        type=str,
        required=True,
        help='private key password',
        default=None
    )

    asyncio.run(_main())
