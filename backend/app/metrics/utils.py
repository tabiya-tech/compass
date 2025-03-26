import json
import hashlib
import binascii

from app.users.auth import UserInfo


def encrypt_events_payload(events_payload: list[dict], user_info: UserInfo) -> str:
    key_data = f"{user_info.decoded_token['sub']}{user_info.decoded_token['iat']}{user_info.decoded_token['exp']}"
    # run the md5 of the key data
    key = hashlib.md5(key_data.encode(), usedforsecurity=False).hexdigest()

    data = json.dumps(events_payload)

    # Initialize an empty list to store encrypted byte values
    encrypted_bytes_list = []

    # Iterate over each character in the input data
    for i, c in enumerate(data):
        key_char = key[i % len(key)]  # Cycle through the key
        encrypted_byte = ord(c) ^ ord(key_char)  # XOR operation
        encrypted_bytes_list.append(encrypted_byte)  # Store the encrypted byte

    # Convert the list of byte values into a bytes object
    encrypted_bytes = bytes(encrypted_bytes_list)

    # Encode the encrypted bytes into a hex string for safe transmission.
    return binascii.hexlify(encrypted_bytes).decode()


def _xor_decrypt(encrypted_hex: str, key: str) -> str:
    # payload is base 64 encoded so that it can be easily processed over the network.
    encrypted_bytes = binascii.unhexlify(encrypted_hex)  # Convert from hex string

    # Initialize an empty list to store decrypted characters
    decrypted_chars = []

    # Iterate over each byte and apply XOR with the corresponding key character.
    for i, b in enumerate(encrypted_bytes):
        key_char = key[i % len(key)]  # Cycle through the key characters, if key is less than the data get the modulo.
        decrypted_char = chr(b ^ ord(key_char))  # XOR operation
        decrypted_chars.append(decrypted_char)  # Store the decrypted character

    # Join the decrypted characters into a string and return
    return ''.join(decrypted_chars)


def decrypt_event_payload(events_payload: str, user_info: UserInfo) -> list[dict]:
    """
    Decrypts the given events payload using the user information

    :param events_payload: The list of events to decrypt
    :param user_info: The User info object
    :return: decrypted list of events.
    """

    # construct the way to get the key used for decrypting, this formula should be the same used as on the frontend
    # for encrypting, otherwise the decryption will not work.
    key_data = f"{user_info.decoded_token['sub']}{user_info.decoded_token['iat']}{user_info.decoded_token['exp']}"
    # run the md5 of the key data
    key = hashlib.md5(key_data.encode(), usedforsecurity=False).hexdigest()

    decrypted_payload = _xor_decrypt(events_payload, key)
    return json.loads(decrypted_payload)
