"""
This module provides a function to generate random data
"""

import string
import random

from app.app_config import ApplicationConfig
from app.version.types import Version


def get_random_session_id():
    return random.randint(0, (1 << 48) - 1)  # nosec B311 # random number for a test session


def get_random_printable_string(length: int):
    """
    Generate a random string of a given length

    :param length: the length of the string
    :return: a random string made of printable characters.
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


def get_random_version() -> Version:
    """
    Generate a random version instance
    """
    return Version(
        branch=get_random_printable_string(10),
        sha="".join(random.choices(string.ascii_letters + string.digits, k=40)),
        date="".join(random.choices(string.ascii_letters + string.digits, k=40)),
        buildNumber=str(random.randint(0, 1000))
    )


def get_random_application_config() -> ApplicationConfig:
    """
    Generate a random application config instance
    """

    return ApplicationConfig(
        version_info=get_random_version(),
        environment_name=get_random_printable_string(10),
        enable_metrics=random.choice([True, False]),
    )
