"""
This script tests the decryption of sensitive personal data using RSA and AES.
"""

import os
import base64
import json
import datetime
import pytest

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.asymmetric import rsa, padding as asymmetric_padding

from app.users.sensitive_personal_data.types import SensitivePersonalData
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
        rsa_key_id=key_id,
        aes_encryption_key=base64.b64encode(encrypted_aes_key).decode(),
        aes_encrypted_data=base64.b64encode(iv + aes_encrypted_data + encryptor.tag).decode(),
        created_at=created_at
    )


@pytest.mark.asyncio
async def test_round_trip_with_size(_rsa_keys, in_memory_userdata_database):
    repository = SensitivePersonalDataRepository(await in_memory_userdata_database)

    # GIVEN some random key ID.
    given_key_id = get_random_printable_string(10)
    # AND the input json
    given_input_path = _get_file_path("given.json")
    # AND the output json path
    given_output_path = _get_file_path("output.json")

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
    await decrypt_sensitive_data_from_database(
        private_key_pem=private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.BestAvailableEncryption(given_password)
        ),
        output_path=given_output_path,
        private_key_password=given_password,
        repository=repository
    )

    # THEN the two files should match
    with open(given_input_path) as file:
        original_data = json.load(file)

    with open(given_output_path) as file:
        decrypted_data = json.load(file)

    assert original_data == decrypted_data

    # clean up
    # remove the output file
    os.remove(given_output_path)
