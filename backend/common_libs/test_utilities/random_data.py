"""
This module provides a function to generate random data
eg:
    - random strings
"""

import string
import random


def get_random_printable_string(length: int):
    """
    Generate a random string of a given length

    :param length: the length of the string
    :return: a random string made of printable characters
    """

    return ''.join(random.choices(string.printable, k=length))


def get_random_user_id():
    """
    Generate a random user id

    :return: a random user id
    """
    id_chars = string.ascii_letters + string.digits
    return ''.join(random.choices(id_chars, k=28))


def get_random_base64_string(length: int):
    """
    Generate a random base64 string of a given length

    :param length: the length of the string
    :return: a random base64 string
    """

    return ''.join(random.choices(string.ascii_letters + string.digits + '+/', k=length))
