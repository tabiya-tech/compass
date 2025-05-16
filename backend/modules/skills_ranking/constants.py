from enum import Enum
from typing import Literal

FEATURE_ID = "skills_ranking"


class ExperimentIds(Enum):
    """
    Experiment IDs for the skills ranking feature.
    each experiment id represents a branch of the feature that we want to test
    """
    COMPARE_AGAINST = "skills_ranking_"
    BUTTON_ORDER = "skills_ranking_button_order_experiment"
    DELAYED_RESULTS = "skills_ranking_delayed_results_experiment"
