import logging

import pytest

from common_libs.test_utilities import get_random_printable_string


def guard_caplog(logger: logging.Logger, caplog: pytest.LogCaptureFixture):
    """
    Guards to ensure that the loggers are correctly setup, otherwise the tests cannot be trusted that they correctly assert the absence of errors and warnings.
    This function should be called at the beginning of each test that uses caplog.
    e.g.
    def test_something(caplog: pytest.LogCaptureFixture):
        guard_caplog(logger, caplog)
        # ... your test code ...
    :param logger: The logger to guard
    :param caplog: The caplog fixture
    :return:
    """
    random_string = get_random_printable_string(10)
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
