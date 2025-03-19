from pydantic import BaseModel

from app.version.types import Version


class ApplicationConfig(BaseModel):
    """
    The application configuration.
    This will be used to store the application configuration, instead of using environment variables directly.
    Eventually, it will be used to conditionally load the configuration from environment variables, a file, or
    during testing, from a fixture.
    """

    environment_name: str
    version_info: Version
    enable_metrics: bool


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


def set_application_config(cfg: ApplicationConfig) -> None:
    """
    Set the application configuration. This should be called once at the start of the application.
    :param cfg:
    :return:
    """
    global _application_config
    _application_config = cfg
