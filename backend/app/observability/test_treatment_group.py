"""
Tests for binding the user's RCT treatment group to the request.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.context_vars import treatment_group_ctx_var
from app.observability.treatment_group import bind_treatment_group, set_treatment_group, treatment_group_from_experiments
from common_libs.observability.testing import in_memory_tracing
from common_libs.observability.tracing import start_trace


@pytest.fixture(autouse=True)
def _restore_treatment_group():
    """The helpers set the context variable for the rest of the request; keep it from leaking between tests."""
    token = treatment_group_ctx_var.set(":none:")
    yield
    treatment_group_ctx_var.reset(token)


class TestTreatmentGroupFromExperiments:
    """
    Tests for reading the treatment group out of a user's experiments.
    """

    @pytest.mark.parametrize("given_experiments, expected_treatment_group", [
        ({"treatment_group": "T1"}, "T1"),
        ({"treatment_group": "T2", "other_experiment": "group-a"}, "T2"),
        ({"other_experiment": "group-a"}, None),
        ({}, None),
        (None, None),
        ({"treatment_group": {"branch": 1}}, None),
    ], ids=["t1", "t2 among other experiments", "no treatment group", "no experiments", "none", "not a string"])
    def test_reads_the_treatment_group(self, given_experiments, expected_treatment_group):
        """Reads the treatment group."""
        # GIVEN a user's experiments
        # WHEN the treatment group is read from them
        actual_treatment_group = treatment_group_from_experiments(given_experiments)

        # THEN expect the treatment group, or None when the user is not in one
        assert actual_treatment_group == expected_treatment_group


class TestSetTreatmentGroup:
    """
    Tests for binding the treatment group from experiments that are already loaded.
    """

    def test_binds_the_treatment_group(self):
        """Binds the treatment group."""
        # GIVEN a user in treatment group T2
        given_experiments = {"treatment_group": "T2"}

        # WHEN it is bound to the request
        set_treatment_group(given_experiments)

        # THEN expect it on the context variable
        assert treatment_group_ctx_var.get() == "T2"

    def test_leaves_the_context_alone_when_the_user_is_in_no_group(self):
        """Leaves the context alone when the user is in no group."""
        # GIVEN a user in no treatment group
        given_experiments = {}

        # WHEN it is bound to the request
        set_treatment_group(given_experiments)

        # THEN expect the context variable to stay unset
        assert treatment_group_ctx_var.get() == ":none:"


class TestBindTreatmentGroup:
    """
    Tests for looking the treatment group up and binding it to the request.
    """

    @pytest.mark.asyncio
    async def test_looks_the_treatment_group_up_and_tags_the_trace_with_it(self):
        """Looks the treatment group up and tags the trace with it."""
        # GIVEN a user in treatment group T1
        given_user_id = "user-1"
        given_repository = MagicMock()
        given_repository.get_experiments_by_user_id = AsyncMock(return_value={"treatment_group": "T1"})

        # WHEN it is bound and a trace is opened
        with in_memory_tracing() as recorded_spans:
            await bind_treatment_group(given_user_id, given_repository)
            with start_trace(name="career_explorer.turn", module="Career Explorer"):
                pass

        # THEN expect the user's experiments to have been looked up
        given_repository.get_experiments_by_user_id.assert_awaited_once_with(given_user_id)
        # AND expect the trace to be tagged with the treatment group
        actual_tags = recorded_spans.by_name("career_explorer.turn").attributes["langfuse.trace.tags"]
        assert "treatment_group:T1" in actual_tags

    @pytest.mark.asyncio
    async def test_carries_on_untagged_when_the_lookup_fails(self):
        """Carries on untagged when the lookup fails."""
        # GIVEN the user preferences cannot be read
        given_repository = MagicMock()
        given_repository.get_experiments_by_user_id = AsyncMock(side_effect=RuntimeError("database down"))

        # WHEN the treatment group is bound
        await bind_treatment_group("user-1", given_repository)

        # THEN expect no error, and the context variable to stay unset
        assert treatment_group_ctx_var.get() == ":none:"
