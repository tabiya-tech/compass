import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Awaitable, Callable, Optional


async def call_with_timeout(
        func: Callable[..., Any] | Callable[..., Awaitable[Any]],
        *,
        timeout_seconds: float,
        args: tuple[Any, ...] = (),
        kwargs: Optional[dict[str, Any]] = None,
        executor: Optional[ThreadPoolExecutor] = None,
) -> Any:
    """
    Execute `func(*args, **kwargs)` and abort if it exceeds `timeout_seconds`.

    - Supports both sync and async callables.
    - For sync callables, runs in a thread executor to avoid blocking the event loop.
    - Raises asyncio.TimeoutError on timeout.
    """
    kwargs = kwargs or {}

    if asyncio.iscoroutinefunction(func):
        return await asyncio.wait_for(func(*args, **kwargs), timeout=timeout_seconds)

    loop = asyncio.get_running_loop()
    if executor is not None:
        return await asyncio.wait_for(loop.run_in_executor(executor, lambda: func(*args, **kwargs)), timeout=timeout_seconds)

    # Create a temporary executor so we can reliably release resources
    with ThreadPoolExecutor(max_workers=1) as pool:
        return await asyncio.wait_for(loop.run_in_executor(pool, lambda: func(*args, **kwargs)), timeout=timeout_seconds)


