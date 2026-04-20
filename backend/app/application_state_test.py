from typing import AsyncIterator
from unittest.mock import AsyncMock

import pytest

from app.application_state import ApplicationState, ApplicationStateManager, ApplicationStateStore
from app.countries import Country
from app.users.generate_session_id import generate_new_session_id


class _StubStore(ApplicationStateStore):
    """Stub store that records which methods the manager invokes."""

    def __init__(self, get_state_return: ApplicationState | None):
        self._get_state_return = get_state_return
        self.save_state_mock = AsyncMock()
        self.get_state_mock = AsyncMock(return_value=get_state_return)

    async def get_state(self, session_id: int):  # type: ignore[override]
        return await self.get_state_mock(session_id)

    async def save_state(self, state: ApplicationState):
        await self.save_state_mock(state)

    async def delete_state(self, session_id: int) -> None:
        raise NotImplementedError

    async def get_all_session_ids(self) -> AsyncIterator[int]:  # type: ignore[override]
        raise NotImplementedError


class TestApplicationStateManagerGetState:
    """
    Tests that the manager only calls new_state+save_state when the store
    signals a genuinely-new session -- never when the store hands back an
    existing (possibly healed) state.
    """

    @pytest.mark.asyncio
    async def test_get_state_does_not_invoke_new_state_when_store_returns_healed_state(self):
        # GIVEN a store that has a session with existing (partially-corrupt but
        # self-healed) state to hand back
        given_session_id = generate_new_session_id()
        given_healed_state = ApplicationState.new_state(
            session_id=given_session_id, country_of_user=Country.ZAMBIA
        )
        # AND a marker so we can tell if the state was replaced with a default
        given_healed_state.collect_experience_state.country_of_user = Country.ZAMBIA

        store = _StubStore(get_state_return=given_healed_state)
        manager = ApplicationStateManager(store=store, default_country_of_user=Country.UNSPECIFIED)

        # WHEN the manager fetches the state
        actual_state = await manager.get_state(given_session_id)

        # THEN the manager returns the healed state exactly as received
        assert actual_state is given_healed_state
        assert actual_state.collect_experience_state.country_of_user == Country.ZAMBIA

        # AND the manager did NOT call save_state on the store -- which would
        # have been the destructive behaviour that overwrote user data
        store.save_state_mock.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_get_state_creates_and_saves_new_state_only_when_store_returns_none(self):
        # GIVEN a store that reports "no state for this session"
        given_session_id = generate_new_session_id()
        store = _StubStore(get_state_return=None)
        manager = ApplicationStateManager(store=store, default_country_of_user=Country.ZAMBIA)

        # WHEN the manager fetches the state
        actual_state = await manager.get_state(given_session_id)

        # THEN a fresh state is returned
        assert actual_state is not None
        assert actual_state.session_id == given_session_id

        # AND the fresh state is persisted via save_state
        store.save_state_mock.assert_awaited_once()
        saved_arg = store.save_state_mock.await_args.args[0]
        assert saved_arg.session_id == given_session_id
