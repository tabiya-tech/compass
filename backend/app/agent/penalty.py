"""
Penalty Module
---------------------------
This module provides utilities for calculating penalties based on error severity levels.

Penalty Strategy:
Each error type is assigned a penalty weight according to its severity, with higher levels
indicating more severe errors (e.g., error1 > error2 > error3 > error4).

Penalties grow geometrically (as 2^level). This geometric progression is chosen deliberately
so that the cumulative penalty of multiple lower-severity errors remains smaller than
the penalty of a single higher-severity error.

This approach allows the system to prioritize choosing responses with multiple lower-severity errors rather than a single higher-severity error,
ensuring that the overall penalty remains lower.
"""

# Cache precomputed penalty values for common levels
_cached_penalties: list[int] = [2 ** i for i in range(16)]  # Cache levels 0-15 initially


def get_penalty(level: int) -> float:
    """
    Calculate the penalty associated with a given severity level.

    The penalty increases geometrically according to 2^level, where higher levels
    represent more severe errors. This structure ensures that a single higher-severity
    error is penalized more heavily than the cumulative penalties of multiple lower-severity errors.

    :param level:  The severity level of the error (0, 1, 2, ...).
    :return: The penalty associated with the given severity level.
    :raises ValueError: If the level is negative.
    """
    if level < 0:
        raise ValueError("Severity level must be non-negative.")
    if level > 64:
        raise ValueError("Severity level must be less than or equal to 64.")
    if level >= len(_cached_penalties):
        # Extend the cached penalties list if the level exceeds the cached range
        _cached_penalties.extend(2 ** i for i in range(len(_cached_penalties), level + 1))

    return _cached_penalties[level]


def get_penalty_for_multiple_errors(level: int, actual_errors_counted: int, max_number_of_errors_expected: int) -> float:
    """
    Calculate the penalty when multiple errors are possible at a given severity level.

    Penalty logic at level N:
    - The cumulative penalty of all previous levels is 2^N - 1.
    - The penalty for reaching level N is 2^N.
    - The difference (1) is distributed equally among the maximum number of expected errors at this level.

    Each observed error adds its share of the remaining +1 penalty.
    This ensures that multiple lower-level errors still do not outweigh a single higher-level error.
    Examples:
        Suppose you are processing a dataset and counting the number of errors at a certain severity level:

        ```python
        data = [...]  # some array of data entries
        results = do_something(data)

        counted_errors = 0
        for result in results:
            if check_error(result):
                counted_errors += 1

        penalty = get_penalty_for_multiple_errors(level=5, actual_errors_counted=counted_errors, max_number_of_errors_expected=len(data))
        print(f"Penalty for this batch: {penalty}")
        ```

        In this example:
        - `level=5` is the severity of the error type you're checking.
        - `actual_errors_counted` is how many errors were found.
        - `max_number_of_errors_expected` is the total number of data entries processed (length of `data`).

        This ensures that if many entries are wrong, the penalty approaches the full penalty at level 5 (2^5 = 32),
        while small numbers of errors only increment the penalty slightly above the cumulative sum of previous levels (2^5 - 1 = 31).

    :param level: The severity level of the error (0, 1, 2, ...).
    :param actual_errors_counted: The number of actual errors counted at this level.
    :param max_number_of_errors_expected: The maximum number of errors expected at this level.
    :return: The penalty associated with the given severity level and error count.
    """
    if actual_errors_counted == 0:
        return 0
    if max_number_of_errors_expected == 0:
        raise ValueError("max_number_of_errors_expected must be greater than 0.")

    penalty_start = get_penalty(level) - 1
    penalty_per_occurrence = 1 / max_number_of_errors_expected
    # Ensure the penalty does not exceed the maximum expected errors
    if actual_errors_counted > max_number_of_errors_expected:
        actual_errors_counted = max_number_of_errors_expected
    return penalty_start + actual_errors_counted * penalty_per_occurrence
