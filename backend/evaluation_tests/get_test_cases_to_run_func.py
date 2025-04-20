import sys
from typing import TypeVar

T = TypeVar('T', bound='CompassTestCase')


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

    _cases_to_run = []
    _force_cases = []
    _skip_cases = []
    for tc in cases_to_run:
        if hasattr(tc, 'skip_force'):
            if tc.skip_force == "force":
                _force_cases.append(tc)
            elif tc.skip_force == "skip":
                _skip_cases.append(tc)
            else:
                _cases_to_run.append(tc)
        else:
            _cases_to_run.append(tc)

    # If there are any test cases that are forced to run, we ignore the rest.
    if _force_cases:
        return _force_cases

    # Exclude test cases that are marked to be skipped.
    if _skip_cases:
        _cases_to_run = [tc for tc in _cases_to_run if tc not in _skip_cases]

    return _cases_to_run
