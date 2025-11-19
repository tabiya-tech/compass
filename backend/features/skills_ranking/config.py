import logging
from pydantic import BaseModel, Field

from features.skills_ranking.state.repositories.default_collections import DefaultCollections as DefaultCollections

_logger = logging.getLogger(__name__)


class SkillsRankingConfig(BaseModel):
    """
    Typed Configuration for the skill ranking feature.
    Now uses external skills-ranking-service instead of internal implementation.
    """

    # External service configuration
    skills_ranking_service_url: str
    """
    The base URL of the external skills-ranking-service.
    """

    skills_ranking_service_api_key: str
    """
    The API key for authenticating with the external skills-ranking-service.
    """

    # State management (still needed for brujula experiment state)
    skills_ranking_state_mongodb_uri: str
    """
    The URI of the skills ranking state MongoDB instance.
    """

    skills_ranking_state_database_name: str
    """
    The name of the skills ranking state database.
    """

    skills_ranking_state_collection_name: str = DefaultCollections.SKILLS_RANKING_STATE
    """
    The collection name for the skills ranking state.
    """

    registration_data_mongodb_uri: str
    """
    The URI of the registration database MongoDB instance.
    """

    registration_data_database_name: str
    """
    The name of the registration data database.
    """

    registration_data_collection_name: str = DefaultCollections.REGISTRATION_DATA
    """
    The registration data collection name.
    """

    high_difference_threshold: float = Field(gt=0)
    """
    Used for calculating if the difference between the self-estimated rank and the actual rank is high.
    This value is used to determine the high difference between the self-estimated rank and the actual
    
    It should be a positive value.
    """

    correct_rotations_threshold_for_group_switch: int = Field(default=30)
    """
    The correct threshold for switching the experiment group.
    If the user don't finish the above rotations on the frontend, it is more likely for the user not to see the
    information, but with more than this threshold, they are more likely to see the information.
    """

    class Config:
        """
        Pydantic configuration for the SkillsRankingConfig model.
        """
        frozen = True


###############
#        Singleton for the config
################

_config: SkillsRankingConfig | None = None


def set_skills_ranking_config(config: SkillsRankingConfig):
    """
    Set the configuration for the skill ranking feature.
    """

    global _config
    _config = config
    _logger.info("Skills ranking feature configuration set")


def get_skills_ranking_config() -> SkillsRankingConfig:
    """
    Get the configurations for the skill ranking feature.
    :return:
    """

    if _config is None:
        raise RuntimeError("Skills Ranking configurations are not setup.")
    return _config
