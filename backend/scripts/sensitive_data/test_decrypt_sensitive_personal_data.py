"""
This script tests the decryption of sensitive personal data using RSA and AES.
"""

import os
import json
import shutil
import pytest
import base64
import datetime

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.asymmetric import rsa, padding as asymmetric_padding

from app.users.sensitive_personal_data.types import SensitivePersonalData, EncryptedSensitivePersonalData
from common_libs.test_utilities.random_data import get_random_printable_string
from app.users.sensitive_personal_data.repository import SensitivePersonalDataRepository
from scripts.sensitive_data.decrypt_sensitive_personal_data import decrypt_sensitive_data_from_database, \
    AES_KEY_LENGTH, IV_SIZE, TAG_LENGTH


def _get_file_path(file_name: str):
    return os.path.join(os.path.dirname(__file__), file_name)


@pytest.fixture
def _rsa_keys():
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    public_key = private_key.public_key()
    return private_key, public_key


def _encrypt_sensitive_test_data(
        sensitive_data: dict[str, str],
        user_id: str,
        key_id: str,
        created_at: datetime,
        public_key: rsa.RSAPublicKeyWithSerialization,
) -> SensitivePersonalData:
    aes_key = os.urandom(AES_KEY_LENGTH)
    iv = os.urandom(IV_SIZE)

    # min tag length is 16 bytes which is 16 * 8 = 128 bits
    cipher = Cipher(algorithms.AES(aes_key), modes.GCM(iv, min_tag_length=TAG_LENGTH * 8))

    serialized_data = json.dumps(sensitive_data).encode()

    encryptor = cipher.encryptor()
    aes_encrypted_data = encryptor.update(serialized_data) + encryptor.finalize()

    encrypted_aes_key = public_key.encrypt(
        aes_key,
        asymmetric_padding.OAEP(
            mgf=asymmetric_padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )

    return SensitivePersonalData(
        user_id=user_id,
        created_at=created_at,
        sensitive_personal_data=EncryptedSensitivePersonalData(
            rsa_key_id=key_id,
            aes_encryption_key=base64.b64encode(encrypted_aes_key).decode(),
            aes_encrypted_data=base64.b64encode(iv + aes_encrypted_data + encryptor.tag).decode()
        )
    )


@pytest.mark.asyncio
async def test_round_trip_with_size(_rsa_keys, in_memory_userdata_database):
    repository = SensitivePersonalDataRepository(await in_memory_userdata_database)

    # GIVEN some random key ID.
    given_key_id = get_random_printable_string(10)
    # AND the input json
    given_input_path = _get_file_path("given.json")

    # AND the output folder path
    given_output_folder = os.path.join(os.path.dirname(__file__), "test_output")
    os.makedirs(given_output_folder, exist_ok=True)

    # AND the RSA keys (public and private keys)
    private_key, public_key = _rsa_keys

    # AND the data from the input file is saved into the database
    # 1. read the data from the file.
    with open(given_input_path) as file:
        given_data = json.load(file)

    # 2. set up test data: encrypt the data,
    encrypted_test_data = []
    for data in given_data:
        # sensitive data is everything except the user_id and created_at
        sensitive_data = {key: value for key, value in data.items() if key not in ["user_id", "created_at"]}

        # save the encrypted data
        encrypted_test_data.append(_encrypt_sensitive_test_data(
            sensitive_data=sensitive_data,
            user_id=data["user_id"],
            key_id=given_key_id,
            created_at=datetime.datetime.fromisoformat(data["created_at"]),
            public_key=public_key
        ))

    # 3. save the test data in the database.
    for data in encrypted_test_data:
        await repository.create(data)

    # 4. encrypt the data into a file
    given_password = get_random_printable_string(10).encode()

    # WHEN the sensitive data is decrypted and saved into the output file.
    given_identifiable_fields = ["first_name", "last_name", "contact_email"]
    await decrypt_sensitive_data_from_database(
        private_key_pem=private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.BestAvailableEncryption(given_password)
        ),
        output_folder_path=given_output_folder,
        private_key_password=given_password,
        repository=repository,
        identifiable_fields=given_identifiable_fields
    )
    import csv
    # THEN the identifiable JSON data should be saved in the output folder
    with open(os.path.join(given_output_folder, "identifiable.json")) as file:
        actual_saved_identifiable_data_json = json.load(file)
    # AND the identifiable JSON data should fulfill the expectations
    assert_identifiable_data(actual_saved_identifiable_data_json, given_data)

    # AND the identifiable CSV data should be saved in the output folder
    with open(os.path.join(given_output_folder, "identifiable.csv")) as file:
        actual_saved_identifiable_data_csv = csv.DictReader(file)
        actual_saved_identifiable_data_csv = [row for row in actual_saved_identifiable_data_csv]
    # AND the identifiable CSV data should fulfill the expectations
    assert_identifiable_data(actual_saved_identifiable_data_csv, given_data)

    # AND the Pseudonymized JSON data should be saved in the output folder
    with open(os.path.join(given_output_folder, "pseudonymized.json")) as file:
        actual_saved_pseudonymized_data_json = json.load(file)
    # AND the pseudonymized JSON data should fulfill the expectations
    assert_pseudonymized_data(actual_saved_pseudonymized_data_json, given_data, given_identifiable_fields)

    # AND the Pseudonymized CSV data should be saved in the output folder
    with open(os.path.join(given_output_folder, "pseudonymized.csv")) as file:
        actual_saved_pseudonymized_data_csv = csv.DictReader(file)
        actual_saved_pseudonymized_data_csv = [row for row in actual_saved_pseudonymized_data_csv]
    # AND the pseudonymized CSV data should fulfill the expectations
    assert_pseudonymized_data(actual_saved_pseudonymized_data_csv, given_data, given_identifiable_fields)

    # AND the anonymized JSON data should be saved in the output folder
    with open(os.path.join(given_output_folder, "anonymized.json")) as file:
        actual_saved_anonymized_data_json = json.load(file)
    # AND the anonymized json should fulfill the expectations
    assert_anonymized_data(actual_saved_anonymized_data_json, given_data, given_identifiable_fields)

    # AND the anonymized CSV data should be saved in the output folder
    with open(os.path.join(given_output_folder, "anonymized.csv")) as file:
        actual_saved_anonymized_data_csv = csv.DictReader(file)
        actual_saved_anonymized_data_csv = [row for row in actual_saved_anonymized_data_csv]
    # AND the anonymized csv data should fulfill the expectations
    assert_anonymized_data(actual_saved_anonymized_data_csv, given_data, given_identifiable_fields)

    # clean up
    # remove the output file
    shutil.rmtree(given_output_folder)


def assert_identifiable_data(
        identifiable_data: list[dict],
        given_data: list[dict]):
    # AND the identifiable data contains the same number of entries as the given data
    assert len(identifiable_data) == len(given_data)
    for i, data in enumerate(identifiable_data):
        # AND the all the data is present
        for field in given_data[i]:
            if field not in ["user_id", "created_at"]:
                assert field in identifiable_data[i]
                assert data[field] == given_data[i][field]


def assert_pseudonymized_data(
        pseudonymized_data: list[dict],
        given_data: list[dict],
        identifiable_fields: list[str]
):
    # AND the pseudonymized data contains the same number of entries as the given data
    assert len(pseudonymized_data) == len(given_data)
    # AND the user ID is part of the identifiable fields
    _identifiable_fields = identifiable_fields.copy()  # make a copy to avoid modifying the original list
    for i, data in enumerate(pseudonymized_data):
        # AND the user ID is present and is not equal to the original user ID
        assert data["user_id"] is not None
        assert data["user_id"] != given_data[i]["user_id"]
        # AND the identifiable data is not present
        for field in _identifiable_fields:
            assert field not in pseudonymized_data[i]
        # AND the pseudonymized data contains the non-identifiable fields
        for field in given_data[i]:
            if field not in _identifiable_fields:
                assert field in pseudonymized_data[i]


def assert_anonymized_data(
        anonymized_data: list[dict],
        given_data: list[dict],
        identifiable_fields: list[str]
):
    # AND the anonymized data contains the same number of entries as the given data
    assert len(anonymized_data) == len(given_data)
    # AND the user ID is part of the identifiable fields
    _identifiable_fields = identifiable_fields.copy()  # make a copy to avoid modifying the original list
    _identifiable_fields.append("user_id")
    for i, data in enumerate(anonymized_data):
        # AND the identifiable data is not present
        for field in _identifiable_fields:
            assert field not in anonymized_data[i]
        # AND the anonymized data contains the non-identifiable fields
        for field in given_data[i]:
            if field not in _identifiable_fields:
                assert field in anonymized_data[i]
