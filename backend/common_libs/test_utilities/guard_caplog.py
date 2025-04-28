import logging
import random

import pytest


def guard_caplog(logger: logging.Logger, caplog: pytest.LogCaptureFixture):
    """
    Guards to ensure that the loggers are correctly setup, otherwise the tests cannot be trusted that they correctly assert the absence of errors and warnings.
    This function should be called at the beginning of each test that uses caplog.
    e.g.
    def test_something(caplog: pytest.LogCaptureFixture):
        with caplog.at_level(logging.DEBUG):
            guard_caplog(logger, caplog)
            # ... your test code ...

    :param logger: The logger to guard
    :param caplog: The caplog fixture
    :return:
    """
    random_string = str(random.randint(0, (1 << 48) - 1))  # nosec B311 # random number for testing purposes
    guard_warning_msg = logging.getLevelName(logging.WARNING) + ":" + random_string  # some random string
    logger.warning(guard_warning_msg)
    # assert that there is a WARNING with the specific message
    assert caplog.records[-1].levelname == 'WARNING'
    assert caplog.records[-1].message == guard_warning_msg
    guard_error_msg = logging.getLevelName(logging.ERROR) + ":" + random_string  # some random string
    logger.error(guard_error_msg)
    # assert that there is an ERROR with the specific message
    assert caplog.records[-1].levelname == 'ERROR'
    assert caplog.records[-1].message == guard_error_msg
    caplog.records.clear()


def assert_log_error_warnings(*, caplog: pytest.LogCaptureFixture, expect_errors_in_logs: bool = False, expect_warnings_in_logs: bool = False):
    """
    Assert that the logs do not contain any errors or warnings.
    e.g.
    def test_something(caplog: pytest.LogCaptureFixture):
        with caplog.at_level(logging.DEBUG):
            # ... your test code ...
            assert_log_error_warnings(caplog, expect_errors_in_logs=False, expect_warnings_in_logs=True)

    :param caplog: The caplog fixture
    :param expect_errors_in_logs: If True, expect errors in the logs. If False, assert that no errors are in the logs.
    :param expect_warnings_in_logs: If True, expect warnings in the logs. If False, assert that no warnings are in the logs.
    """
    # Check that no errors and no warning were logged
    # Get all errors in a consolidated list
    errors = [record.getMessage() for record in caplog.records if record.levelname == 'ERROR']
    # Get all warnings in a consolidated list
    warnings = [record.getMessage() for record in caplog.records if record.levelname == 'WARNING']
    if not expect_errors_in_logs and len(errors) > 0:
        pytest.fail(f"Did not expect an error in the logs: {errors}")
    if not expect_warnings_in_logs and len(warnings) > 0:
        pytest.fail(f"Did not expect a warning in the logs: {warnings}")
