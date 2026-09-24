"""
Binds the user's RCT treatment group to the request, so that LLM traces can be split by it.

The treatment group ("T1", "T2", ...) is assigned out of band and stored on the user's preferences
under `experiments.treatment_group`. The routes that open a trace bind it to
`treatment_group_ctx_var`, and `start_trace` turns it into a `treatment_group:<group>` tag.
"""

import logging
from typing import Optional

from app.context_vars import treatment_group_ctx_var
from app.users.repositories import IUserPreferenceRepository
from app.users.types import Experiments

logger = logging.getLogger(__name__)

TREATMENT_GROUP_EXPERIMENT_KEY = "treatment_group"
"""The key the treatment group is stored under in `user_preferences.experiments`."""


def treatment_group_from_experiments(experiments: Optional[Experiments]) -> Optional[str]:
    """
    Read the treatment group out of a user's experiments.

    :param experiments: The user's experiments, possibly None.
    :return: The treatment group, or None if the user is not in one.
    """
    value = (experiments or {}).get(TREATMENT_GROUP_EXPERIMENT_KEY)
    return value if isinstance(value, str) and value else None


def set_treatment_group(experiments: Optional[Experiments]) -> None:
    """
    Bind the treatment group from experiments that are already loaded to the current request.

    :param experiments: The user's experiments, possibly None.
    """
    treatment_group = treatment_group_from_experiments(experiments)
    if treatment_group:
        treatment_group_ctx_var.set(treatment_group)


async def bind_treatment_group(user_id: str, user_preferences_repository: IUserPreferenceRepository) -> None:
    """
    Look the user's treatment group up and bind it to the current request.

    Tracing must never break the request it observes, so a failed lookup is logged and the request
    carries on untagged.

    :param user_id: The user making the request.
    :param user_preferences_repository: The repository to read the user's experiments from.
    """
    try:
        set_treatment_group(await user_preferences_repository.get_experiments_by_user_id(user_id))
    except Exception as e:  # pylint: disable=broad-except
        logger.warning("Failed to look up the treatment group; the trace will not be tagged with it. Error: %s", e)
