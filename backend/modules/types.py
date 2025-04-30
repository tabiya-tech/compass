from dataclasses import dataclass
from typing import Any, Literal

from fastapi import FastAPI, APIRouter
from pydantic import BaseModel
from abc import ABC, abstractmethod

from app.users.auth import Authentication


class FeatureConfig(BaseModel):
    class_path: str
    enabled: bool
    config: dict[str, Any]

"""
Abstract base class for features.
"""
class IFeature(ABC):
    @abstractmethod
    async def init(self, config: FeatureConfig):
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
    feature: IFeature
    config: FeatureConfig
