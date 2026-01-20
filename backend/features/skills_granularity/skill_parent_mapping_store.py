import asyncio
import logging
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from .constants import (
    SKILL_PARENT_MAPPING_COLLECTION,
    CHILD_SKILL_ID_FIELD,
    PARENT_LABEL_FIELD,
)

_cache: dict[str, str] = {}
_initialized = False
_lock = asyncio.Lock()


async def initialize(*, db: AsyncIOMotorDatabase, logger: logging.Logger) -> None:
    global _initialized, _cache
    if _initialized:
        return

    async with _lock:
        if _initialized:
            return

        collection = db.get_collection(SKILL_PARENT_MAPPING_COLLECTION)
        cursor = collection.find(
            {},
            {
                CHILD_SKILL_ID_FIELD: 1,
                PARENT_LABEL_FIELD: 1,
                "_id": 0,
            },
        )

        mapping: dict[str, str] = {}
        async for doc in cursor:
            child_skill_id = doc.get(CHILD_SKILL_ID_FIELD)
            parent_label = doc.get(PARENT_LABEL_FIELD)
            if child_skill_id and parent_label:
                mapping[str(child_skill_id)] = parent_label

        _cache = mapping
        _initialized = True
        logger.info("Loaded %d skill parent mappings", len(_cache))


def get_parent_label(child_skill_id: str) -> Optional[str]:
    if not child_skill_id:
        return None
    return _cache.get(child_skill_id)


def is_initialized() -> bool:
    return _initialized


def set_cache_for_tests(mapping: dict[str, str]) -> None:
    global _cache, _initialized
    _cache = dict(mapping)
    _initialized = True


def clear_cache_for_tests() -> None:
    global _cache, _initialized
    _cache = {}
    _initialized = False
