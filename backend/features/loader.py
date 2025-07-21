import asyncio
import importlib
import logging
from http import HTTPStatus
from textwrap import dedent
from typing import List

from fastapi import APIRouter
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.app_config import ApplicationConfig
from app.users.auth import Authentication
from .types import FeatureState, FeatureStatus

logger = logging.getLogger(__name__)


async def _init_feature(feature_state: FeatureState, application_db: AsyncIOMotorDatabase):
    """
    Initialize a feature instance

    — this function is called during the application startup.
    — it does not throw on error
    """

    try:
        await feature_state.instance.init(feature_state.feature_setup.config, application_db)
        feature_state.status = "up"
    except Exception as e:
        feature_state.status = "failed_to_init"
        logger.exception(f"Error initializing feature {feature_state.feature_setup.feature_name}: {e}")


async def _tear_down(feature_state: FeatureState):
    """
    Tear down a feature instance

    — this function is called during the application shutdown.
    — it does not throw on error because we want to continue with the other features.
    """

    try:
        await feature_state.instance.tear_down()
    except Exception as e:
        logger.exception(f"Error tearing down feature {feature_state.feature_setup.class_path}: {e}")


class FeatureLoader:
    """
    Feature Loader class
    Responsible for loading the features, initializing them and teardown.
    """
    enabled_features: List[FeatureState] = []

    def __init__(self, application_config: ApplicationConfig):
        # clear all the already existing enabled features
        self.enabled_features = []

        for feature_id, feature_config in application_config.features.items():
            try:
                if feature_config.enabled:
                    feature_module = importlib.import_module(feature_config.class_path)
                    feature_instance = getattr(feature_module, feature_config.class_name)()

                    self.enabled_features.append(FeatureState(
                        feature_id=feature_id,
                        feature_setup=feature_config,
                        instance=feature_instance,
                        status="loaded"
                    ))

            except Exception as e:
                logger.exception(f"Could load feature {feature_id} with name {feature_config.feature_name}: {e}")

    async def init(self, application_db: AsyncIOMotorDatabase):
        # This function should not fail
        # right now: _init_feature throws an exception if the feature fails to initialize,
        # but we want to continue with the other features.
        await asyncio.gather(
            *[_init_feature(feature_state, application_db) for feature_state in self.enabled_features]
        )

    def add_routes(self, features_router: APIRouter, auth: Authentication):
        """
        Add routes to the features.
        """

        for feature_state in self.enabled_features:
            try:
                # if the feature has a router, add it to the features router provided as parameter
                router = feature_state.instance.get_api_router(auth)
                if router:
                    # prefix the router with the feature id
                    # so that the routes are grouped by feature id.,
                    # and the feature cannot overwritten by the routes of other features or the main app.
                    _prefix = f"/{feature_state.feature_id}"

                    # add the router to the `features router`
                    features_router.include_router(router, prefix=_prefix,
                                                   tags=[feature_state.feature_setup.feature_name])
            except Exception as e:
                logger.exception(f"Error adding routes for feature {feature_state.feature_setup.class_path}: {e}")

        # add the health endpoint to the features router
        self._add_health_endpoint(features_router)

    async def tear_down(self):
        # This function should not fail
        # right now: _tear_down throws an exception if the feature fails to teardown,
        # but we want to continue with the other features.
        await asyncio.gather(
            *[_tear_down(feature_state) for feature_state in self.enabled_features]
        )

    def _get_features_health(self) -> dict[str, FeatureStatus]:
        """
        Get the health of the enabled features.
        """
        return {feature_state.feature_id: feature_state.status for feature_state in self.enabled_features}

    def _add_health_endpoint(self, features_router: APIRouter):
        @features_router.get(
            path="/health",
            description=dedent("""
                                Retrieve the health status of the features enabled on the application.
                                Each feature is identified by its UUID.
                                
                                Returns:
                                    dict[str, FeatureStatus]: A dictionary where the keys are feature IDs (UUIDs)
                                
                                Feature Status can be:
                                - "loaded":
                                    The feature is loaded but not initialized. This means it has been imported and is ready to be initialized.
                                
                                - "up": The feature is initialized and running.
                                    This means the feature has been successfully initialized and is operational.
                                
                                - "failed_to_init": The feature didn't initialize.
                                    This means there was an error during the initialization process of the feature.
            """),
            responses={
                HTTPStatus.OK: {
                    "description": "Health status of the features",
                    "content": {
                        "application/json": {
                            "example": {
                                "9394674a-d442-469c-8d05-c586b2e5b3e3": "loaded",
                                "b5954ae5-b303-4d62-8562-e0e141ad947c": "up",
                                "560dfd10-87d2-4df5-9029-55983796a258": "failed_to_init"
                            }
                        }
                    }
                }
            }
        )
        def _features_health_check() -> dict[str, FeatureStatus]:
            return self._get_features_health()
