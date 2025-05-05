from dataclasses import dataclass
from typing import Any

from fastapi import APIRouter
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from abc import ABC, abstractmethod

from app.users.auth import Authentication


class FeatureSetupConfig(BaseModel):
    """
    The Feature setup configuration representation.
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
    The configuration for the feature.
    """


class IFeature(ABC):
    """
    Abstract base class for features.
    """

    @abstractmethod
    async def init(self, config: dict[str, Any], application_db: AsyncIOMotorDatabase):
        """
        Initialize the feature.
        This method should be called at the setup of the feature.
        It can do things like:-

        1) initializing of the database collections and creation of respective indexes.
        :return:
        """
        raise NotImplementedError

    def get_api_router(self, auth: Authentication) -> APIRouter | None:
        """
        [Optional] Get the API Router for the feature.
        :return:
        """

    async def tear_down(self):
        """
        [Optional] Tear down function
        :return:
        """


@dataclass
class FeatureState:
    """
    State of the feature.
    """

    instance: IFeature
    """
    The feature Implementation instance.
    """

    feature_setup: FeatureSetupConfig
    """
    The feature setup properties/configs
    """
