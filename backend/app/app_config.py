from pydantic import BaseModel

from app.countries import Country
from app.version.types import Version

from modules.types import FeatureSetupConfig

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

    features: dict[str, FeatureSetupConfig]


_application_config: ApplicationConfig | None = None


def get_application_config() -> ApplicationConfig:
    """
    Get the application configuration.
    Before calling this function, the application configuration must be set using `set_application_config`.
    :return:
    """
    if _application_config is None:
        raise RuntimeError("Application configuration is not setup.")
    return _application_config


def set_application_config(cfg: ApplicationConfig | None) -> None:
    """
    Set the application configuration. This should be called once at the start of the application.
    :param cfg:
    :return:
    """
    global _application_config
    _application_config = cfg
