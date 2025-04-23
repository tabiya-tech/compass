from enum import Enum
from typing import Optional, Literal

from pydantic import BaseModel


class SkillsRankingCurrentState(Enum):
    INITIAL = "INITIAL"
    SKIPPED = "SKIPPED"
    SELF_EVALUATING = "SELF_EVALUATING"
    EVALUATED = "EVALUATED"


"""
States navigation graph for the skills ranking process.
The graph defines the possible transitions between states in the skills ranking process.

For the states that are terminal, the list is empty.
"""
StatesNavigationGraph = {
    SkillsRankingCurrentState.INITIAL: [
        SkillsRankingCurrentState.SELF_EVALUATING,
        SkillsRankingCurrentState.SKIPPED,
    ],
    SkillsRankingCurrentState.SKIPPED: [],
    SkillsRankingCurrentState.SELF_EVALUATING: [
        SkillsRankingCurrentState.EVALUATED
    ],
    SkillsRankingCurrentState.EVALUATED: []
}

ExperimentGroup = Literal['GROUP_A', 'GROUP_B']


class SkillsRankingState(BaseModel):
    """
    Skills Ranking State — The state of the skills ranking process.
    """

    session_id: int
    """
    session id - the session ranking will be made on
    """

    experiment_group: Optional[ExperimentGroup] = None
    """
    The experiment group the user is in, optional because it may be not experimental.
    """

    current_state: SkillsRankingCurrentState
    """
    The phase of the skills ranking process.
    """

    ranking: Optional[str] = None
    """
    The ranking of the skills got during a conversation.
    """

    self_ranking: Optional[str] = None
    """
    The self ranking of the skills got during a conversation.
    """
