from typing import Optional

from pydantic import BaseModel, Field

from app.countries import Country
from app.i18n.language_config import LanguageConfig
from app.users.cv.constants import DEFAULT_MAX_UPLOADS_PER_USER, DEFAULT_RATE_LIMIT_PER_MINUTE
from app.version.types import Version
from features.types import FeatureSetupConfig

_APPLICATION_NOT_CONFIGURED_ERROR_MESSAGE = "Application configuration is not setup."


class ApplicationConfig(BaseModel):
    """
    The application configuration.
    This will be used to store the application configuration, instead of using environment variables directly.
    Eventually, it will be used to conditionally load the configuration from environment variables, a file, or
    during testing, from a fixture.
    """

    environment_name: str
    """
    The name of the environment the application is running in.
    """

    version_info: Version
    """
    The version information of the application.
    """

    enable_metrics: bool
    """
    A flag to enable or disable metrics.
    """

    default_country_of_user: Country
    """
    The default country of the user.
    """

    taxonomy_model_id: str
    """
    The taxonomy model id.
    """

    embeddings_service_name: str
    """
    The embeddings service name to use.
    """

    embeddings_model_name: str
    """
    The name of the embeddings model to use.
    """

    features: Optional[dict[str, FeatureSetupConfig]] = {}
    """
    The backend features configuration.
    This is a dictionary that can contain various feature and their configurations.
    """

    experience_pipeline_config: Optional[dict[str, str | int | bool]] = {}
    """
    The configuration for the experience pipeline.
    This is a dictionary that can contain various settings for the pipeline.
    """

    # CV storage and upload limits
    cv_storage_bucket: str
    cv_max_uploads_per_user: Optional[int] = Field(default=DEFAULT_MAX_UPLOADS_PER_USER, gt=0)
    cv_rate_limit_per_minute: Optional[int] = Field(default=DEFAULT_RATE_LIMIT_PER_MINUTE, gt=0)

    language_config: LanguageConfig
    """
    The language configuration for the backend, including default locale and available locales with date formats.
    """

    app_name: str
    """
    The name of the application.
    """


_application_config: ApplicationConfig | None = None


def get_application_config() -> ApplicationConfig:
    """
    Get the application configuration.
    Before calling this function, the application configuration must be set using `set_application_config`.
    :return:
    """
    if _application_config is None:
        raise RuntimeError(_APPLICATION_NOT_CONFIGURED_ERROR_MESSAGE)
    return _application_config


def set_application_config(cfg: ApplicationConfig | None) -> None:
    """
    Set the application configuration. This should be called once at the start of the application.
    :param cfg:
    :return:
    """
    global _application_config
    _application_config = cfg
