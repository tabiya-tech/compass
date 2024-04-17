import sys
from typing import TypeVar

T = TypeVar('T')


def get_test_cases_to_run(all_test_cases: list[T]) -> list[T]:
    """
    Returns the test cases to be run. Filters to only test cases specified in a command line flag is set.
    """
    # Using sys.argv instead of pytest constructs, since this needs to be used in a fixture.
    # A fixture cannot call another fixture.
    if '--test_cases_to_run' not in sys.argv:
        return all_test_cases
    cases_to_run = sys.argv[sys.argv.index('--test_cases_to_run') + 1].split(',')
    return [case for case in all_test_cases if case.name in cases_to_run]
