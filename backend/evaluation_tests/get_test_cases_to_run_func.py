import sys
from typing import TypeVar

T = TypeVar('T')


def get_test_cases_to_run(all_test_cases: list[T]) -> list[T]:
    """
    Returns the test cases to be run. Filters to only test cases specified in a command line flag is set.
    """
    # Using sys.argv instead of pytest constructs, since this needs to be used in a fixture.
    # A fixture cannot call another fixture.
    cases_to_run: list[T] = all_test_cases
    if '--test_cases_to_run' in sys.argv:
        cases_to_run_str = sys.argv[sys.argv.index('--test_cases_to_run') + 1].split(',')
        cases_to_run = [case for case in all_test_cases if case.name in cases_to_run_str]

    if '--test_cases_to_exclude' in sys.argv:
        cases_to_exclude_str = sys.argv[sys.argv.index('--test_cases_to_exclude') + 1].split(',')
        cases_to_run = [case for case in cases_to_run if case.name not in cases_to_exclude_str]

    return cases_to_run
