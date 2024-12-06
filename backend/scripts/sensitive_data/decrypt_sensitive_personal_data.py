"""
script to decrypt the sensitive personal data
"""

import base64
import argparse
import asyncio
import json
import logging

from typing import Optional, Final

from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.asymmetric import padding as asymmetric_padding

from app.users.sensitive_personal_data.types import SensitivePersonalData
from app.users.sensitive_personal_data.repository import SensitivePersonalDataRepository
from app.server_dependencies.db_dependencies import CompassDBProvider

logger = logging.getLogger(__name__)


IV_SIZE: Final[int] = 12  # The initialization vector size in bytes
TAG_LENGTH: Final[int] = 16  # 16 bytes, which is 128 bits
AES_KEY_LENGTH: Final[int] = 32  # 32 bytes, which is 256 bits


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
    # get first 16 bytes from the encrypted data as the tag for the GCM
    # 16 comes from the fact that the tag is 16 bytes long which is 128 bits
    # and our tag-length is 128 bits
    tag = aes_encrypted_bytes[-TAG_LENGTH:]

    cipher = Cipher(algorithms.AES(aes_decryption_key), modes.GCM(initialization_vector=iv, tag=tag))

    decrypting_fn = cipher.decryptor()

    decrypted_message = decrypting_fn.update(aes_encrypted_bytes[:-TAG_LENGTH]) + decrypting_fn.finalize()

    return decrypted_message


async def _decrypt_sensitive_personal_data(_private_key: RSAPrivateKey, encrypted_personal_data: SensitivePersonalData):
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
        cyphertext = base64.b64decode(encrypted_personal_data.aes_encrypted_data)
        decryption_key = base64.b64decode(encrypted_personal_data.aes_encryption_key)

        cyphertext_array = [byte for byte in cyphertext]
        decryption_key_array = [byte for byte in decryption_key]

        aes_iv = cyphertext_array[:IV_SIZE]
        aes_encrypted_text = cyphertext_array[IV_SIZE:]

        aes_decryption_key = _rsa_decrypt_message(_private_key, bytes(decryption_key_array))

        personal_data = _aes_decrypt_message(bytes(aes_iv), bytes(aes_decryption_key), bytes(aes_encrypted_text))

        return {
            "user_id": encrypted_personal_data.user_id,
            **json.loads(personal_data.decode()),
            "created_at": encrypted_personal_data.created_at.__str__()
        }
    except Exception as e:
        logger.error(f"Error decrypting data for user {encrypted_personal_data.user_id}: {e}")
        return {
            "user_id": encrypted_personal_data.user_id,
            "error": "Error decrypting data: " + str(e),
            "key_id": encrypted_personal_data.rsa_key_id,
            "created_at": encrypted_personal_data.created_at.__str__()
        }


async def decrypt_sensitive_data_from_database(
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
    user_data = repository.stream()
    decrypted_data = []

    logger.info("starting to decrypt the sensitive personal data")
    start_time = asyncio.get_event_loop().time()
    async for personal_data in user_data:
        decrypted_datum = await _decrypt_sensitive_personal_data(private_key, personal_data)
        decrypted_data.append(decrypted_datum)

    logger.info(f"decryption took {(asyncio.get_event_loop().time() - start_time):.2f} seconds to decrypt {len(decrypted_data)} records")

    # writing the decrypted data to a file
    with open(output_path, "w") as file:
        file.write(json.dumps(decrypted_data, indent=2))


async def _main():
    args = parser.parse_args()

    private_key_path = args.private_key_path
    _private_key_password: str = args.password
    _output_path = args.output_path

    # load the private key
    with open(private_key_path, "rb") as f:
        _private_key_pem = f.read()

    compass_users_db = await CompassDBProvider.get_users_db()
    repository = SensitivePersonalDataRepository(db=compass_users_db)

    await decrypt_sensitive_data_from_database(
        _private_key_pem,
        _private_key_password.encode() if _private_key_password else None,
        _output_path,
        repository=repository
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="decrypt saved sensitive personal data")

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
