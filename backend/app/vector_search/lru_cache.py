import asyncio
import copy
import logging
from collections import OrderedDict
from typing import Literal, Optional, TypeAlias

from pympler import asizeof

CacheUnit: TypeAlias = Literal["bytes", "kb", "mb", "gb"]


class AsyncLRUCache:
    """
    An asynchronous LRU (Least Recently Used) cache implementation with a maximum size.
    This cache supports asynchronous operations and is thread-safe.
    """

    def __init__(self, *, name="Cache", max_size=128):
        self.name = name
        self.cache = OrderedDict()
        self.max_size = max_size
        self._logger = logging.getLogger(self.__class__.__name__)
        self._lock = asyncio.Lock()  # Async-safe lock

        # Stats
        self._hits = 0
        self._misses = 0
        self._evictions = 0
        self._sets = 0
        self._overwrites = 0

    async def get(self, key):
        """
        Get a value from the cache by its key.
        A deep copy of the value is returned to ensure that the original value in the cache is not modified.
        :param key: The key to retrieve from the cache.
        :return: The value associated with the key, or None if the key does not exist.

        """
        async with self._lock:
            if key in self.cache:
                self._hits += 1
                self.cache.move_to_end(key)
                self._logger.debug("[CACHE HIT] [%s] Key: %s", self.name, key)
                return copy.deepcopy(self.cache[key])
            else:
                self._misses += 1
                self._logger.debug("[CACHE MISS] [%s] Key: %s", self.name, key)
                return None

    async def set(self, key, value) -> None:
        """
        Set a value in the cache with the given key.
        A deep copy of the value is stored to ensure that the original value is not modified.
        :param key: The key to set in the cache.
        :param value: The value to set in the cache.
        """
        async with self._lock:
            is_new_key = key not in self.cache

            if not is_new_key:
                self._overwrites += 1
                self.cache.move_to_end(key)
            else:
                self._sets += 1

            self.cache[key] = copy.deepcopy(value)
            self._logger.debug("[CACHE SET] [%s] Key: %s", self.name, key)

            if is_new_key and len(self.cache) > self.max_size:
                self._evictions += 1
                evicted_key, _ = self.cache.popitem(last=False)
                self._logger.debug(f"[CACHE EVICT] [%s] Key: %s", self.name, key)

    async def clear(self) -> None:
        """
        Clear the cache.
        """
        async with self._lock:
            self.cache.clear()
            self._logger.info(f"[CACHE CLEARED] [%s] All keys have been cleared.", self.name)

    async def size(self) -> int:
        """
        Get the current size of the cache.
        :return: Number of items in the cache.
        """
        async with self._lock:
            return len(self.cache)

    async def stats(self):
        """
        Get the cache statistics including hits, misses, hit rate, total requests, sets, overwrites, evictions,
        :return: A dictionary containing cache statistics.
        """
        async with self._lock:
            total_requests = self._hits + self._misses
            hit_rate = (self._hits / total_requests * 100) if total_requests else 0.0
            return {
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate_percent": round(hit_rate, 2),
                "total_get_requests": total_requests,
                "sets": self._sets,
                "overwrites": self._overwrites,
                "evictions": self._evictions,
                "current_size": len(self.cache),
                "max_size": self.max_size,
                "memory_usage_bytes": await self._memory_usage_sync("bytes")
            }

    async def clear_stats(self):
        """
        Clear the cache statistics.
        :return: True if stats were cleared successfully.
        """
        async with self._lock:
            self._hits = 0
            self._misses = 0
            self._evictions = 0
            self._sets = 0
            self._overwrites = 0
            self._logger.debug(f"[CACHE STATS CLEARED] [%s] All stats have been cleared.", self.name)
            return True

    async def memory_usage(self, unit: CacheUnit = "bytes") -> int:
        """
        Get the current memory usage.
        :param unit: The unit of measurement for memory usage. Can be "bytes", "kb", "mb", or "gb".
        :return: Memory usage in the specified unit.
        """
        async with self._lock:
            return await self._memory_usage_sync(unit)

    async def _memory_usage_sync(self, unit: CacheUnit = "bytes") -> int:
        # Total size in bytes (recursively)
        _bytes = asizeof.asizeof(self.cache)
        if unit == "bytes":
            return _bytes
        elif unit == "kb":
            return _bytes // 1024
        elif unit == "mb":
            return _bytes // (1024 * 1024)
        else:  # unit == "gb":
            return _bytes // (1024 * 1024 * 1024)


class CacheClearDebouncer:
    """
    Manages debounced cache clearing to prevent frequent redundant operations.

    This class is designed to prevent frequent clearing of a cache by employing a debouncing
    mechanism. It ensures that the cache is cleared only once after a designated delay,
    regardless of how many times the operation is triggered during the delay period.
    This is particularly useful in scenarios where cache clearing requests might occur
    in rapid succession.
    """

    def __init__(self, *, cache: AsyncLRUCache, logger: logging.Logger, delay: float = 5.0):
        self._cache = cache
        self._logger = logger
        self._delay = delay
        self._lock = asyncio.Lock()
        self._pending_task: Optional[asyncio.Task] = None

    async def schedule_clear(self) -> None:
        """
        Schedule a debounced cache clear operation.
        """
        async with self._lock:
            if self._pending_task is None or self._pending_task.done():
                self._logger.info("Scheduling debounced cache clear in %.1f seconds.", self._delay)
                self._pending_task = asyncio.create_task(self._debounced_clear())
            else:
                self._logger.debug("Debounced cache clear already scheduled; skipping.")

    async def _debounced_clear(self) -> None:
        await asyncio.sleep(self._delay)
        await self._cache.clear()
        self._logger.debug("Cache cleared after debounce.")
