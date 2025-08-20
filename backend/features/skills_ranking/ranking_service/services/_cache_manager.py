import asyncio
import logging
from datetime import datetime
from typing import Optional, Callable, Coroutine, TypeVar, Generic

T = TypeVar('T')


class CacheManager(Generic[T]):
    """
    A class to manage the cache of data of any type.
    """

    def __init__(self,
                 stale_time: int,
                 fetch_latest_value: Callable[[], Coroutine[None, None, T]],
                 compute_version: Optional[Callable[[T], str]] = None):
        """
        Initialize the CacheManager.

        :param stale_time: The time in seconds after which the cache is considered stale.
        :param fetch_latest_value: A callable that fetches the latest value of type T.
        """
        self._logger = logging.getLogger(self.__class__.__name__)

        self._stale_time = stale_time
        self._fetch_latest_value = fetch_latest_value
        self._compute_version = compute_version

        self._cached_value: Optional[T] = None
        """
        The cached value. the value the user is currently looking at.
        None means that the value is not yet fetched.
        """

        self._last_fetch_time: Optional[datetime] = None
        self._cached_version: Optional[str] = None
        """
        Optional version string computed from the cached value at fetch time.
        """

        """
        The last time the value was fetched.
        None means that the value has never been fetched.
        """

        self._fetch_lock = asyncio.Lock()
        """
        Lock to ensure that only one fetch operation happens at a time.
        """

        self._wait_lock = asyncio.Lock()
        """
        Lock to ensure that only one wait operation happens at a time.
        """

        self._fetching_task: Optional[asyncio.Task] = None
        """
        Reference to the task that is currently fetching the latest value.
        None means that there is no fetching task in progress.
        """

        self._logger.info("Cache Manager initialized")

    def _is_data_fresh(self) -> bool:
        """
        Check if the cached data is fresh (within the last allowed stale time).
        """
        # if the last fetch time is None, it means data has never been fetched
        # return False -> Data is not fresh (Fetch new data)
        if self._last_fetch_time is None:
            return False

        since_last_fetch_time = datetime.now() - self._last_fetch_time

        # check if the active period is less than or equal to the stale time
        is_data_fresh = since_last_fetch_time.total_seconds() <= self._stale_time
        return is_data_fresh

    async def _fetch_and_update_cache(self) -> None:
        """
        Fetch new data and update the cache value with the latest value.
        """

        try:
            self._logger.info("Starting value fetch")

            # Fetch new data
            self._cached_value = await self._fetch_latest_value()
            self._last_fetch_time = datetime.now()

            # Compute version if requested
            if self._compute_version is not None:
                try:
                    self._cached_version = self._compute_version(self._cached_value)
                except Exception as e:
                    self._logger.error(f"Failed to compute cached value version: {e}")
                    self._cached_version = None

            self._logger.info("data fetched and cache updated successfully")
        except Exception as e:
            self._logger.error(f"Failed to fetch data: {e}")
            raise

    def _task_done_callback(self, _):
        """
        Callback to be called when the task is done.
        """
        self._logger.debug("Fetch task completed")
        self._fetching_task = None

    async def _create_fetch_task(self) -> asyncio.Task | None:
        """
        Trigger a fetch and update cache task if not already running.
        If it is already fetching, return the existing task.

        :return: The task that is fetching the latest value or None if the data is fresh.
        """

        # if we have an already fetching task, return it
        if self._fetching_task is not None:
            return self._fetching_task

        # use locker to ensure that only one fetch operation happens at a time
        async with self._fetch_lock:
            # If many requests have been waiting for this lock, and one request manages to initiate the task.
            # Then the next tasks on the queue will get the task.
            if self._fetching_task is not None:
                return self._fetching_task

            # if the data is fresh, ie: many requests have been waiting for this lock,
            # and one request initiates the task.
            # And the data was fetched and cached recently,
            # then the next tasks on the queue will get the cached data.
            if self._is_data_fresh():
                return None

            created_task = asyncio.create_task(self._fetch_and_update_cache())
            created_task.add_done_callback(self._task_done_callback)
            self._fetching_task = created_task
            return created_task

    async def get(self) -> T:
        """
        Get the cached value or fetch it if stale.
        """
        #   Is data fresh —> Yes
        #   Cache -> Not available.
        #   Action -> an Unexpected case,
        #             mark last fetch time as None, to mark state as it was never fetched.
        if self._is_data_fresh() and self._cached_value is None:
            self._logger.error("Cache is fresh but empty, Unexpected state in CacheManager.get()")
            self._last_fetch_time = None

        #   Is data fresh —> Yes
        #   Cache -> Available.
        #   Action -> Return the cached data.
        if self._is_data_fresh() and self._cached_value is not None:
            self._logger.debug("Returning fresh cached value")
            return self._cached_value

        #   Is data fresh —> No
        #   Cache -> Available.
        #   Action -> Trigger a fetch task to update the cache and return the cached data.
        if not self._is_data_fresh() and self._cached_value is not None:
            self._logger.debug("Cache is stale, returning cached data and triggering fetch task")
            await self._create_fetch_task()
            return self._cached_value

        #   Is data fresh —> No
        #   Cache -> Not available.
        #   Action -> Trigger a fetch task to update the cache.
        #             Wait for the task to complete and return the cached data.
        if not self._is_data_fresh() and self._cached_value is None:
            self._logger.debug("Cache is stale and empty, triggering fetch task")
            await self._create_fetch_task()

            # if the fetch task is still running, wait for it to complete
            async with self._wait_lock:
               if self._fetching_task is not None:
                    await self._fetching_task

            return self._cached_value

        raise RuntimeError("Unexpected state in CacheManager.get()")

    @property
    def version(self) -> Optional[str]:
        return self._cached_version
