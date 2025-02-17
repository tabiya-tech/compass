def get_custom_error() -> tuple[type[Exception], Exception]:
    """
    Get a custom error class, and an instance of the custom error class.

    Use this function to get a custom error class, and an instance of the custom error class.
    :return: Tuple[Type[Exception], Exception]
    """
    class _GivenError(Exception):
        pass

    given_error = _GivenError("given error message")

    return _GivenError, given_error
