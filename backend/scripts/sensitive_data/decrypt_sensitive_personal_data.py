#!/usr/bin/env python3

"""
script to decrypt the sensitive personal data
"""

import sys
import os
import hashlib
import base64
import argparse
import asyncio
import json
import logging

from textwrap import dedent
from dotenv import load_dotenv
from datetime import datetime, timezone
from typing import Optional, Final, Union
from motor.motor_asyncio import AsyncIOMotorClient
from common_libs.logging.log_utilities import setup_logging_config
from pydantic import BaseModel, field_validator, field_serializer

from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.asymmetric import padding as asymmetric_padding

from app.users.sensitive_personal_data.types import SensitivePersonalData
from app.users.sensitive_personal_data.repository import SensitivePersonalDataRepository

# load environment variables from .env file
load_dotenv()

# setup logging
setup_logging_config(os.path.join("logging.cfg.yaml"))
logger = logging.getLogger(__name__)

IV_SIZE: Final[int] = 12  # The initialization vector size in bytes
TAG_LENGTH: Final[int] = 16  # 16 bytes, which is 128 bits
AES_KEY_LENGTH: Final[int] = 32  # 32 bytes, which is 256 bits

#####################################################
#              TYPES
####################################################

# the field content values can either be a string, or a list of strings
# @see: frontend-new/src/sensitiveData/types.ts#FieldContentValue.
FieldContentValue = Union[str, list[str]]


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


def _anonymize_user_id(user_id: str) -> str:
    """
    Anonymizes the user ID by hashing it with MD5.

    :return: The anonymized user ID as a hexadecimal string.
    """
    return hashlib.md5(user_id.encode(), usedforsecurity=False).hexdigest()


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


async def _decrypt_sensitive_personal_data(_private_key: RSAPrivateKey,
                                           encrypted_personal_data: SensitivePersonalData) -> DecryptedPersonalDataModel:
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


async def _anonymise_decrypted_data(decrypted_data: list[DecryptedPersonalDataModel],
                                    identifiable_fields: list[str]) \
        -> tuple[
            list[dict[str, FieldContentValue]],
            list[dict[str, FieldContentValue]],
            list[dict[str, FieldContentValue]]
        ]:
    """
    Anonymizes the decrypted data by removing identifiable fields and anonymizing the user ID.

    :param decrypted_data: The decrypted sensitive personal data
    :param identifiable_fields: The fields to be removed from the plain data for security reasons.

    :return: (plain_data, pseudonymized_data, public_data)
    """

    plain_data = []
    pseudonymized_data = []
    public_data = []

    for datum in decrypted_data:
        # 1. in the plain data we keep all fields including the identifiable fields and the user id.
        plain_data.append(datum.model_dump(mode="json"))

        # Anonymize the user_id for pseudonymized and public data
        datum.user_id = _anonymize_user_id(datum.user_id)

        # Create a pseudonymized version of the data
        anonymized_datum = datum.model_copy()

        # 2. by removing the identifiable fields.
        for field in identifiable_fields:
            if hasattr(anonymized_datum, field):
                delattr(anonymized_datum, field)

        pseudonymized_data.append(anonymized_datum.model_dump(mode="json"))

        # 3. in the public data we remove the user_id
        if hasattr(anonymized_datum, "user_id"):
            delattr(anonymized_datum, "user_id")

        public_data.append(anonymized_datum.model_dump(mode="json"))

    return plain_data, pseudonymized_data, public_data


async def decrypt_sensitive_data_from_database(*,
                                               private_key_pem: bytes,
                                               private_key_password: Optional[bytes],
                                               output_folder_path: str,
                                               repository: SensitivePersonalDataRepository,
                                               identifiable_fields: list[str]) -> list[DecryptedPersonalDataModel]:
    """
    Main function to decrypt the sensitive personal data.

    :param identifiable_fields: sensitive fields that can be used to identify a user, and should be omitted from the public version.
    :param repository:  The repository to get the sensitive personal data from
    :param output_folder_path: The path to the output folder
    :param private_key_password: the password of the private key
    :param private_key_pem: The RSA private key in PEM format.

    :return: List[DecryptedPersonalDataModel] — The decrypted sensitive personal data.
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

    logger.info(
        f"decryption took {(asyncio.get_event_loop().time() - start_time):.2f} seconds to decrypt {len(decrypted_data)} records")

    # writing the decrypted data to a file
    plain_content, pseudonymized_content, public_content = await _anonymise_decrypted_data(
        decrypted_data=decrypted_data,
        identifiable_fields=identifiable_fields
    )

    plain_content_file = os.path.join(output_folder_path, "plain.json")
    pseudonymized_content_file = os.path.join(output_folder_path, "pseudonymized.json")
    public_content_file = os.path.join(output_folder_path, "public.json")

    with open(plain_content_file, "w", encoding="UTF-8") as file:
        file.write(json.dumps(plain_content, ensure_ascii=False, indent=2))

    with open(pseudonymized_content_file, "w", encoding="UTF-8") as file:
        file.write(json.dumps(pseudonymized_content, ensure_ascii=False, indent=2))

    with open(public_content_file, "w", encoding="UTF-8") as file:
        file.write(json.dumps(public_content, ensure_ascii=False, indent=2))

    return decrypted_data


async def _main():
    args = parser.parse_args()

    private_key_path = args.private_key_path
    _private_key_password: str = args.password

    # load the private key
    with open(private_key_path, "rb") as f:
        _private_key_pem = f.read()

    # Ensure the parent directory exists
    output_folder_path = args.output_folder_path
    os.makedirs(output_folder_path, exist_ok=True)

    # connect to the database
    mongo_uri = os.getenv("DECRYPT_SCRIPT_USERDATA_MONGODB_URI")
    if not mongo_uri:
        raise ValueError(
            "The userdata MongoDB URI is not set in the environment variables (DECRYPT_SCRIPT_USERDATA_MONGODB_URI)")

    database_name = os.getenv("DECRYPT_SCRIPT_USERDATA_DB_NAME")
    if not database_name:
        raise ValueError(
            "The userdata MongoDB database name is not set in the environment variables (DECRYPT_SCRIPT_USERDATA_DB_NAME)")

    # Connect to MongoDB
    client = AsyncIOMotorClient(mongo_uri, tlsAllowInvalidCertificates=True)
    si = await client.server_info()
    host, port = client.address
    logger.info(
        f"Connected to the database {database_name} at {host}:{port} version:{si.get('version', 'Unknown version')}")
    db = client.get_database(database_name)
    repository = SensitivePersonalDataRepository(db=db)

    # decrypt the data and save them in the plain.json
    decrypted_data = await decrypt_sensitive_data_from_database(
        private_key_pem=_private_key_pem,
        private_key_password=_private_key_password.encode() if _private_key_password else None,
        output_folder_path=output_folder_path,
        identifiable_fields=args.identifiable_fields,
        repository=repository
    )

    do_plot = args.do_plot
    if do_plot:
        logger.info("starting to plot distribution of the data")

        from _plotting import plot
        plot(
            data=decrypted_data,
            output_dir=output_folder_path,
            string_fields=args.string_fields,
            bin_size=args.bin_size,
            numeric_fields=args.numeric_fields)

    logger.info("Decryption and anonymization completed successfully.")

if __name__ == "__main__":
    if sys.version_info < (3, 11):
        sys.exit("This script requires Python 3.11 or higher.")

    parser = argparse.ArgumentParser(description=dedent("""
                                        decrypt saved sensitive personal data 
                                        This script decrypts sensitive personal data stored in a MongoDB database using a private RSA key.
                                        Outputs the three files.
                                        - plain.json: contains the decrypted sensitive personal data in JSON format.
                                        - pseudonymized.json: Contains the pseudonymized sensitive personal data in JSON format.
                                                              Meaning email and names are removed and user_id is anonymized.
                                        - public.json: Contains the sharable sensitive personal data in JSON format. without user_id, email and names
                                        """),
                                     formatter_class=argparse.RawTextHelpFormatter,
                                     epilog="The following environment variables are required: DECRYPT_SCRIPT_USERDATA_MONGODB_URI, "
                                            "DECRYPT_SCRIPT_USERDATA_DB_NAME")

    plotting_options = parser.add_argument_group('Plotting Options')
    plotting_options.add_argument(
        '--do-plot',
        action='store_true',
        help='Enable plotting. If set, --string-fields or --number-fields must be provided.'
    )

    plotting_options.add_argument(
        '--string-fields',
        nargs='*',  # Accepts zero or more string values
        type=str,
        default=[],
        help='Space-separated list of string fields to be binned for plotting.'
    )

    plotting_options.add_argument(
        '--numeric-fields',
        nargs='*',  # Accepts zero or more numeric values
        type=str,
        default=[],
        help='Space-separated list of numeric fields to be binned for plotting.'
    )

    plotting_options.add_argument(
        '--bin-size',
        type=int,
        default=5,
        help='Size of the bins for numeric fields. Default is 5.',
    )

    parser.add_argument(
        '--private-key-path',
        type=str,
        required=True,
        help='Path to the PEM-format private key file (absolute or relative to the current working directory).',
        default=None
    )

    parser.add_argument(
        '--output-folder-path',
        type=str,
        required=True,
        help='Path to the output folder (absolute or relative to the current working directory).',
        default=None
    )

    parser.add_argument(
        '--identifiable-fields',
        type=str,
        required=False,
        help='Space-separated list of fields to keep in the decrypted data. \n'
             'If not provided, all fields will be kept in the pseudonymized and public data.',
        default=[],
        nargs='+',
    )

    parser.add_argument(
        '--password',
        type=str,
        required=True,
        help='The private key password',
        default=None
    )

    args = parser.parse_args()

    if args.do_plot and not (args.string_fields or args.numeric):
        parser.error("--do-plot requires either --string-fields or --numeric-fields to be provided.")


    if (args.string_fields or args.numeric or args.bin_size) and not args.do_plot:
        parser.error("--string-fields, --numeric-fields, and --bin-size can only be used with --do-plot.")

    if args.bin_size and args.bin_size <= 0:
        parser.error("--bin-size must be a positive integer.")

    if args.bin_size and not len(args.numeric_fields):
        parser.error("--bin-size can only be used with --numeric-fields.")

    asyncio.run(_main())
