import asyncio
import logging
import importlib
from typing import List

from fastapi import FastAPI
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.app_config import ApplicationConfig
from app.users.auth import Authentication

from modules.types import FeatureState

logger = logging.getLogger(__name__)


async def _init_feature(feature_state: FeatureState, application_db: AsyncIOMotorDatabase):
    try:
        await feature_state.instance.init(feature_state.feature_setup.config, application_db)
    except Exception as e:
        logger.exception(f"Error initializing feature {feature_state.feature_setup.class_path}: {e}")


async def _tear_down(feature_state: FeatureState):
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

        for feature in application_config.features.keys():
            feature_config = application_config.features[feature]
            try:
                if feature_config.enabled:
                    feature_module = importlib.import_module(feature_config.class_path)
                    feature_instance = getattr(feature_module, feature_config.class_name)()

                    self.enabled_features.append(FeatureState(
                        feature_setup=feature_config,
                        instance=feature_instance,
                    ))

            except Exception as e:
                logger.exception(f"Could load feature {feature}: {e}")

    async def init(self, application_db: AsyncIOMotorDatabase):
        # This function should not fail
        # right now: _init_feature throws an exception if the feature fails to initialize,
        # but we want to continue with the other features.
        await asyncio.gather(
            *[_init_feature(feature_state, application_db) for feature_state in self.enabled_features]
        )

    def add_routes(self, app: FastAPI, auth: Authentication):
        """
        Add routes to the features.
        """

        for feature_state in self.enabled_features:
            try:
                # if the feature has a router, add it to the app.
                router = feature_state.instance.get_api_router(auth)
                if router:
                    app.include_router(router)
            except Exception as e:
                logger.exception(f"Error adding routes for feature {feature_state.feature_setup.class_path}: {e}")

    async def tear_down(self):
        # This function should not fail
        # right now: _tear_down throws an exception if the feature fails to teardown,
        # but we want to continue with the other features.
        await asyncio.gather(
            *[_tear_down(feature_state) for feature_state in self.enabled_features]
        )
