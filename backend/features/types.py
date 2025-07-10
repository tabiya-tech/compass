from typing import Any, Literal
from dataclasses import dataclass


from fastapi import APIRouter
from pydantic import BaseModel
from abc import ABC, abstractmethod
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.users.auth import Authentication


class FeatureSetupConfig(BaseModel):
    """
    The Feature setup configuration representation.
    """

    feature_name: str
    """
    The human readable name (title) of the feature.
    """

    enabled: bool
    """
    A flag to enable or disable the feature.
    """

    class_path: str
    """
    The path to the module where the feature class is defined.
    """

    class_name: str
    """
    The name of the class to be loaded. (It must implement the "IFeature" interface)
    """

    config: dict[str, Any]
    """
    The configuration for the feature, validate and typed by the feature implementation.
    """


class IFeature(ABC):
    """
    Abstract base class for application features.

    This class defines the contract for all features in the application.
    Features are:
        modular components that encapsulate specific functionality and expose REST API endpoints.

    Feature Lifecycle:

    1. **Construction** (__init__):
       -> Called when the feature is loaded
       -> Should perform only lightweight initialization (loggers, basic setup)
       -> Must not perform heavy operations or async calls
       -> Must not raise exceptions
       -> If this fails, the feature will be disabled, not `initialized` or teardown will not be called.

    2. **Initialization** (init):
       -> Called during application startup after FastAPI app creation, it is hooked in the app lifespan startup
       -> Can perform async operations (database setup, external service connections)
       -> Should handle errors gracefully and not raise exceptions

    3. **API Registration** (get_api_router):
       -> Called to retrieve the feature's API endpoints
       -> Should return a FastAPI APIRouter with all feature endpoints
       -> Must not raise exceptions
       -> Can return None if the feature has no API endpoints
       -> This function can be called even before the feature is initialized,
            so it should not depend on any state that is set in the `init` method.
            The actual execution of the endpoints will only happen after the feature is initialized.

    4. **Teardown** (tear_down):
       -> Called during application shutdown
       -> Used for cleanup operations (closing connections, releasing resources)
       -> Can perform async operations
       -> Should handle errors gracefully

    Example:
        ```python
        class MyFeature(IFeature):
            def __init__(self):
                self.logger = logging.getLogger(MyFeature.__name__)
                self.db_collection = None

            async def init (self, config: dict[str, Any], application_db: AsyncIOMotorDatabase):
                try:
                    self.db_collection = application_db.my_collection
                    await self.db_collection.create_index("timestamp")
                    self.logger.info("MyFeature initialized successfully")
                except Exception as e:
                    self.logger.error("Didn't initialize MyFeature: {e}")

            def get_api_router(self, auth: Authentication) -> APIRouter:
                router = APIRouter(prefix="/my-feature", tags=["my-feature"])

                @router.get("/health")
                async def health_check():
                    return {"status": "healthy"}

                return router

            async def tear_down(self):
                self.logger.info("MyFeature shutting down")
        ```
    """

    @abstractmethod
    async def init(self, config: dict[str, Any], application_db: AsyncIOMotorDatabase):
        """
        Initialize the feature.
        This method should be called at the startup of the application.
        """
        raise NotImplementedError

    @abstractmethod
    def get_api_router(self, _auth: Authentication) -> APIRouter | None:
        """
        [Optional] Get the API Router for the feature.
        """
        return None

    async def tear_down(self):
        """
        [Optional] Tear down function
        """
        pass

FeatureStatus = Literal["loaded", "up", "failed_to_init"]

@dataclass
class FeatureState:
    """
    State of the feature.
    """

    feature_id: str
    """
    The unique identifier of the feature.
    """

    instance: IFeature
    """
    The feature Implementation instance.
    """

    feature_setup: FeatureSetupConfig
    """
    The feature setup properties/configs
    """

    status: FeatureStatus = "loaded"
    """
    The status of the feature.
    """
