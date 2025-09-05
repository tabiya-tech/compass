import asyncio
import time
from concurrent.futures import ThreadPoolExecutor

import pytest

from common_libs.call_with_timeout.call_with_timeout import call_with_timeout


class TestCallWithTimeout:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "given_delay_seconds, given_timeout_seconds, should_timeout, expected_result",
        [
            (0.05, 0.30, False, "done"),  # completes
            (0.20, 0.05, True, None),      # times out
        ],
    )
    async def test_async_callable_behaviors(self, given_delay_seconds: float, given_timeout_seconds: float, should_timeout: bool, expected_result: str | None):
        # GIVEN an async callable and timing parameters
        async def given_async_func(delay: float):
            await asyncio.sleep(delay)
            return "done"

        # WHEN calling with a timeout wrapper
        if should_timeout:
            # THEN a timeout error is raised
            with pytest.raises(asyncio.TimeoutError):
                await call_with_timeout(given_async_func, timeout_seconds=given_timeout_seconds, args=(given_delay_seconds,))
        else:
            # THEN the expected result is returned
            actual_result = await call_with_timeout(given_async_func, timeout_seconds=given_timeout_seconds, args=(given_delay_seconds,))
            assert actual_result == expected_result

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "given_delay_seconds, given_timeout_seconds, should_timeout, expected_result",
        [
            (0.05, 0.30, False, 42),  # completes
            (0.20, 0.05, True, None), # times out
        ],
    )
    async def test_sync_callable_behaviors_default_executor(self, given_delay_seconds: float, given_timeout_seconds: float, should_timeout: bool, expected_result: int | None):
        # GIVEN a sync callable and timing parameters
        def given_sync_func(delay: float):
            time.sleep(delay)
            return 42

        # WHEN calling with a timeout wrapper (default executor)
        if should_timeout:
            # THEN a timeout error is raised
            with pytest.raises(asyncio.TimeoutError):
                await call_with_timeout(given_sync_func, timeout_seconds=given_timeout_seconds, args=(given_delay_seconds,))
        else:
            # THEN the expected result is returned
            actual_result = await call_with_timeout(given_sync_func, timeout_seconds=given_timeout_seconds, args=(given_delay_seconds,))
            assert actual_result == expected_result

    @pytest.mark.asyncio
    async def test_sync_callable_times_out_with_custom_executor(self):
        # GIVEN a sync callable and a custom executor
        def given_sync_func(delay: float):
            time.sleep(delay)
            return 1

        given_delay_seconds = 0.20
        given_timeout_seconds = 0.05

        # WHEN calling with a timeout wrapper (custom executor)
        with ThreadPoolExecutor(max_workers=1) as given_executor:
            # THEN a timeout error is raised
            with pytest.raises(asyncio.TimeoutError):
                await call_with_timeout(
                    given_sync_func,
                    timeout_seconds=given_timeout_seconds,
                    args=(given_delay_seconds,),
                    executor=given_executor,
                )


