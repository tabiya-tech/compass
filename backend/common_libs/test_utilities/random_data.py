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
