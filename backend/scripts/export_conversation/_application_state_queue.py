import asyncio
import logging
from typing import Optional

from app.application_state import ApplicationState, ApplicationStateStore

ApplicationStateQueue = asyncio.Queue[Optional[ApplicationState]]

logger = logging.getLogger(__name__)


async def _fetcher(*,
                   queue: ApplicationStateQueue,
                   source_store: ApplicationStateStore,
                   session_ids: list[int]) -> None:
    """
    Fetch sessions from source store and put them in the queue to be processed.
    """

    for session_id in session_ids:
        state = await source_store.get_state(session_id)

        if state is None:
            logger.warning(f"Session {session_id} not found in source store, skipping it")
            continue

        await queue.put(state)
        logger.info(f"Queued conversation with session id: {session_id} for export")

    # Signal end of processing
    await queue.put(None)


async def _saver(*,
                 queue: ApplicationStateQueue,
                 target_store: ApplicationStateStore) -> None:
    """
    Save sessions to target store from the queue.

    :param queue: The queue to fetch session IDs from
    :param target_store:  The target store to save sessions to
    :return: None.
    """

    while True:
        state = await queue.get()
        # if state is None (signal to stop), break the loop
        if state is None:
            break

        try:
            # Save to target store.
            await target_store.save_state(state)
            logger.info(f"Exported conversation with session id: {state.session_id}")
        except Exception as e:
            logger.error(f"Error saving conversation with session id: {state.session_id}: {e}")
        finally:
            queue.task_done()
