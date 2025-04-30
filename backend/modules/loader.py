import asyncio
import logging
import importlib
from typing import List

from fastapi import FastAPI

from app.app_config import get_application_config
from app.users.auth import Authentication

from modules.types import FeatureState

logger = logging.getLogger(__name__)

"""
Feature Loader class
Responsible for loading the features, initializing them and teardown.
"""

async def _init_feature(feature: FeatureState):
    try:
        await feature.feature.init(feature.config.config)
    except Exception as e:
        logger.exception(f"Error initializing feature {feature.config.class_path}: {e}")


async def _tear_down(feature: FeatureState):
    try:
        await feature.feature.tear_down()
        feature.status = "TERMINATED"
    except Exception as e:
        logger.exception(f"Error tearing down feature {feature.config.class_path}: {e}")
        feature.status = "TERMINATED"

class FeatureLoader:
    enabled_features: List[FeatureState] = []

    def __init__(self):
        _application_config = get_application_config()

        # clear all the already existing enabled features
        self.enabled_features = []

        for feature in _application_config.features.keys():
            feature_config = _application_config.features[feature]
            try:
                if feature_config.enabled:
                    feature_class = importlib.import_module(feature_config.class_path)
                    feature_instance = feature_class.Feature()

                    self.enabled_features.append(FeatureState(
                        config=feature_config,
                        feature=feature_instance,
                    ))

            except ImportError as e:
                logger.exception(f"Could load feature {feature}: {e}")

    async def init(self):
        await asyncio.gather(
            *[_init_feature(feature) for feature in self.enabled_features]
        )

    def add_routes(self, app: FastAPI, auth: Authentication):
        """
        Add routes to the features.
        """

        for feature in self.enabled_features:
            router = feature.feature.get_api_router(auth)
            app.include_router(router)


    async def tear_down(self):
        await asyncio.gather(
            *[_tear_down(feature) for feature in self.enabled_features]
        )
