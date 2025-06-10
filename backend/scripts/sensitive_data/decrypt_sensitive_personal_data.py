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


def _pseudonymize_user_id(user_id: str) -> str:
    """
    Pseudonymize the user ID by hashing it with MD5.

    :return: The pseudonymized user ID as a hexadecimal string.
    """

    return hashlib.md5(user_id.encode(), usedforsecurity=False).hexdigest()


def _extract_rsa_private_crypto_key(pem_key: bytes, password: Optional[bytes]) -> RSAPrivateKey:
    """
    Extracts the RSA private key from a PEM formatted string/bytes.
    """

    return serialization.load_pem_private_key(
        pem_key,
        password=password
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
            # noinspection PyArgumentList
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

        # noinspection PyArgumentList
        return DecryptedPersonalDataModel(
            user_id=encrypted_personal_data.user_id,
            created_at=encrypted_personal_data.created_at,
            **json.loads(personal_data.decode())
        )
    except Exception as e:
        logger.error(f"Error decrypting data for user {encrypted_personal_data.user_id}: {e}")
        # noinspection PyArgumentList
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
    Pseudonymize and Anonymize the decrypted data.
    The decrypted are processed to create three versions of the data, Identifiable, Pseudonymized, and Anonymized:
    - Identifiable means that the user_id and all the data fields, including the additional identifiable fields, are kept.
    - Pseudonymized means that the user_id is hashed, and additional identifiable fields are removed.
    - Anonymized means that the user_id is removed, and identifiable fields are removed.

    :param decrypted_data: The decrypted sensitive personal data
    :param identifiable_fields: Additional fields that can be used to identify a user

    :return: (identifiable_data, pseudonymized_data, anonymized_data)
    """

    identifiable_data = []
    pseudonymized_data = []
    anonymized_data = []

    for datum in decrypted_data:
        # 1. in the identifiable_data we keep all fields including the identifiable fields and the user id.
        identifiable_data.append(datum.model_dump(mode="json"))

        # Pseudonymize the user_id for pseudonymized and anonymized data
        datum.user_id = _pseudonymize_user_id(datum.user_id)

        # Create a pseudonymized version of the data
        pseudonymized_datum = datum.model_copy()

        # 2. by removing the identifiable fields.
        for field in identifiable_fields:
            if hasattr(pseudonymized_datum, field):
                delattr(pseudonymized_datum, field)

        pseudonymized_data.append(pseudonymized_datum.model_dump(mode="json"))

        # 3. anonymize the data by removing the user_id
        if hasattr(pseudonymized_datum, "user_id"):
            delattr(pseudonymized_datum, "user_id")

        anonymized_data.append(pseudonymized_datum.model_dump(mode="json"))

    return identifiable_data, pseudonymized_data, anonymized_data


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
    logger.info("Identifiable fields are: %s", identifiable_fields)
    identifiable_content, pseudonymized_content, anonymized_content = await _anonymise_decrypted_data(
        decrypted_data=decrypted_data,
        identifiable_fields=identifiable_fields
    )

    save_json(identifiable_content, os.path.join(output_folder_path, "identifiable.json"))
    save_csv(identifiable_content, os.path.join(output_folder_path, "identifiable.csv"))

    save_json(pseudonymized_content, os.path.join(output_folder_path, "pseudonymized.json"))
    save_csv(pseudonymized_content, os.path.join(output_folder_path, "pseudonymized.csv"))

    save_json(anonymized_content, os.path.join(output_folder_path, "anonymized.json"))
    save_csv(anonymized_content, os.path.join(output_folder_path, "anonymized.csv"))

    return decrypted_data


def save_csv(data: list[dict], output_path: str):
    """
    Saves the given data to a CSV file at the specified output path.

    :param data: The data to be saved in CSV format.
    :param output_path: The path where the CSV file will be saved.
    """
    import csv
    # Step 1: Collect all possible fieldnames
    fieldnames = set()
    for row in data:
        fieldnames.update(row.keys())

    fieldnames = sorted(fieldnames)  # Optional: sort columns alphabetically

    # Step 2: Write CSV
    with open(output_path, 'w', newline='', encoding='utf-8') as f_out:
        writer = csv.DictWriter(f_out, fieldnames=fieldnames)
        writer.writeheader()

        for row in data:
            writer.writerow(row)


def save_json(data: list[dict], output_path: str):
    """
    Saves the given data to a JSON file at the specified output path.

    :param data: The data to be saved in JSON format.
    :param output_path: The path where the JSON file will be saved.
    """
    with open(output_path, "w", encoding="UTF-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
    logger.info(f"Data saved to {output_path}")


async def _main(*,
                mongo_uri: str,
                database_name: str,
                private_key_path: str,
                private_key_password: str | None,
                output_folder_path: str,
                identifiable_fields: list[str],
                do_plot: bool,
                string_fields: list[str],
                numeric_fields: list[str],
                bin_size: int) -> None:
    """
    Decrypts sensitive data from a MongoDB database, processes it, and optionally generates
    plots for data distribution. Saves the processed data to a specified output folder.

    :param mongo_uri: The MongoDB connection URI for connecting to the database.
    :param database_name: The name of the MongoDB database to connect to.
    :param private_key_path: Path to the private key file used for data decryption.
    :param private_key_password: Password for the private key, if it's encrypted.
        Can be None if the key doesn't require a password.
    :param output_folder_path: Path to the folder where output files (including
        decrypted data and plots) will be saved.
    :param identifiable_fields: A list of MongoDB fields containing identifiable
        information that needs to be decrypted and processed.
    :param do_plot: Boolean flag indicating whether to generate plots for data distributions
        of decrypted fields.
    :param string_fields: A list of fields considered as strings for data distribution
        plotting.
    :param numeric_fields: A list of fields considered as numeric for data distribution
        plotting.
    :param bin_size: Bin size to be used for plotting numeric field distributions.
    :return: None. The function performs all actions asynchronously without returning
        any values. Output files are saved to the specified output folder.
    """

    # load the private key
    with open(private_key_path, "rb") as f:
        _private_key_pem = f.read()

    # Ensure the parent directory exists
    output_folder_path = output_folder_path
    os.makedirs(output_folder_path, exist_ok=True)

    # Connect to MongoDB
    client = AsyncIOMotorClient(mongo_uri, tlsAllowInvalidCertificates=True)
    si = await client.server_info()
    host, port = client.address
    logger.info(
        f"Connected to the database {database_name} at {host}:{port} version:{si.get('version', 'Unknown version')}")
    db = client.get_database(database_name)
    repository = SensitivePersonalDataRepository(db=db)

    # decrypt the data and save it to the output folder
    decrypted_data = await decrypt_sensitive_data_from_database(
        private_key_pem=_private_key_pem,
        private_key_password=private_key_password.encode() if private_key_password else None,
        output_folder_path=output_folder_path,
        identifiable_fields=identifiable_fields,
        repository=repository
    )

    do_plot = do_plot
    if do_plot:
        logger.info("starting to plot distribution of the data")

        from _plotting import plot
        plot(
            data=decrypted_data,
            output_dir=output_folder_path,
            string_fields=string_fields,
            bin_size=bin_size,
            numeric_fields=numeric_fields)

    logger.info("Decryption and anonymization completed successfully.")

if __name__ == "__main__":
    if sys.version_info < (3, 11):
        sys.exit("This script requires Python 3.11 or higher.")

    parser = argparse.ArgumentParser(description=dedent("""
                                        decrypt saved sensitive personal data 
                                        This script decrypts sensitive personal data stored in a MongoDB database using a private RSA key.
                                        Outputs the files in both JSON and CSV formats, containing three versions of the data:
                                        - identifiable:  Contains all the decrypted sensitive personal data in JSON format.
                                        - pseudonymized: Contains the pseudonymized sensitive personal data in JSON format.
                                                         The user_id is hashed, and identifiable fields are removed.
                                        - anonymized:    Contains the anonymized sensitive personal data in JSON format.
                                                         The user_id is removed, and identifiable fields are removed.
                                        """),
                                     formatter_class=argparse.RawTextHelpFormatter,
                                     epilog=dedent("""\
                                     The following environment variables are required: 
                                        - DECRYPT_SCRIPT_USERDATA_MONGODB_URI The URI of the MongoDB database containing the sensitive personal data.
                                        - DECRYPT_SCRIPT_USERDATA_DB_NAME The name of the MongoDB database containing the sensitive personal data.
                                        - DECRYPT_SCRIPT_PRIVATE_KEY_PASSWORD The password for the private key used to decrypt the sensitive personal data.
                                        """))

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
        help='Space-separated list of fields to remove from the decrypted data. \n'
             'If not provided, all fields will be kept in the pseudonymized and public data.',
        default=[],
        nargs='+',
    )

    args = parser.parse_args()

    if args.do_plot and not (args.string_fields or args.numeric_fields):
        parser.error("--do-plot requires either --string-fields or --numeric-fields to be provided.")

    if (args.string_fields or args.numeric_fields or args.bin_size) and not args.do_plot:
        parser.error("--string-fields, --numeric-fields, and --bin-size can only be used with --do-plot.")

    if args.bin_size and args.bin_size <= 0:
        parser.error("--bin-size must be a positive integer.")

    if args.bin_size and not len(args.numeric_fields):
        parser.error("--bin-size can only be used with --numeric-fields.")

    _mongo_uri = os.getenv("DECRYPT_SCRIPT_USERDATA_MONGODB_URI")
    if not _mongo_uri:
        raise ValueError(
            "The userdata MongoDB URI is not set in the environment variables (DECRYPT_SCRIPT_USERDATA_MONGODB_URI)")

    _database_name = os.getenv("DECRYPT_SCRIPT_USERDATA_DB_NAME")
    if not _database_name:
        raise ValueError(
            "The userdata MongoDB database name is not set in the environment variables (DECRYPT_SCRIPT_USERDATA_DB_NAME)")

    _private_key_password = os.getenv("DECRYPT_SCRIPT_PRIVATE_KEY_PASSWORD", None)
    if not _private_key_password:
        logger.info("No private key password provided. The private key will be used without a password.")

    asyncio.run(_main(
        mongo_uri=_mongo_uri,
        database_name=_database_name,
        private_key_path=args.private_key_path,
        output_folder_path=args.output_folder_path,
        identifiable_fields=args.identifiable_fields,
        private_key_password=_private_key_password,
        do_plot=args.do_plot,
        string_fields=args.string_fields,
        numeric_fields=args.numeric_fields,
        bin_size=args.bin_size
    ))
