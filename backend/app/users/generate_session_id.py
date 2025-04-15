import random


def generate_new_session_id():
    """
    Generate a new session ID
    :return: a new session ID
    """

    # TODO: Ensure that the session ID is unique in the database.
    return random.randint(0, (1 << 48) - 1)  # nosec
