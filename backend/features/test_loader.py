import importlib
from typing import Awaitable, cast, Any
from uuid import uuid4

import pytest
from unittest.mock import Mock, patch

from fastapi import APIRouter
from httpx import ASGITransport, AsyncClient

import pytest_mock
from starlette.datastructures import State
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.server_dependencies.db_dependencies import CompassDBProvider
from common_libs.test_utilities.setup_env_vars import setup_env_vars, teardown_env_vars
from features.loader import FeatureLoader
from features.types import IFeature


class _TestFeature(IFeature):

    async def init(self, config: dict[str, Any], application_db: AsyncIOMotorDatabase):
        """
        Test Feature initialization method.
        """
        pass

    def get_api_router(self, _auth):
        router = APIRouter(prefix="/test-feature")

        @router.get("/health")
        def health():
            """
            Health check endpoint for the TestFeature.
            """
            return {"status": "healthy"}

        return router

    async def tear_down(self):
        """
        Test Feature tear down method.
        """
        pass


class TestLoader:
    @pytest.mark.asyncio
    async def test_enabled_feature(self, in_memory_application_database: AsyncIOMotorDatabase):
        # GIVEN a random test feature is initialized,
        # AND the feature is enabled in the application config

        given_feature_id = f'test_feature_{uuid4()}'
        mock_application_config = Mock()
        mock_application_config.features = {
            given_feature_id: Mock(
                enabled=True,
                class_path='test_module',
                class_name='TestFeature',
                feature_name='Test Feature',
                config={"some_config_key": "some_config_value"}
            )
        }

        # AND a FeatureConfig class is defined in the module
        mock_feature_instance = Mock()
        feature_api_router = Mock()
        mock_feature_instance.get_api_router = Mock(return_value=feature_api_router)
        mock_feature_module = Mock()
        mock_feature_module.TestFeature = Mock(return_value=mock_feature_instance)

        # AND the import lib will return the mocked module
        with patch('importlib.import_module', return_value=mock_feature_module):
            # WHEN the feature loader is initialized
            loader = FeatureLoader(mock_application_config)

            # THEN the feature.__init__ method should be called
            mock_feature_module.TestFeature.assert_called_once()

            # AND the feature should be added to `enabled_features`.
            assert len(loader.enabled_features) == 1
            assert loader.enabled_features[0].instance == mock_feature_instance

            # WHEN the feature loader is initialized (calling init method)
            await loader.init(in_memory_application_database)

            # THEN the mock_feature_module.TestFeature.init should be called with the correct config and database
            mock_feature_instance.init.assert_called_once_with(
                mock_application_config.features[given_feature_id].config,
                in_memory_application_database
            )

            # WHEN the feature is initialized with the features API router
            features_api_router = Mock()
            loader.add_routes(features_api_router, Mock())

            # THEN feature_router.include_router should be called with the feature's API router
            features_api_router.include_router.assert_called_once()
            features_api_router.include_router.assert_called_with(
                mock_feature_instance.get_api_router.return_value,
                prefix=f"/{given_feature_id}",
                tags=[mock_application_config.features[given_feature_id].feature_name]
            )

            # WHEN the feature loader is torn down
            await loader.tear_down()

            # THEN the mock_feature_module.TestFeature.tear_down should be called
            mock_feature_instance.tear_down.assert_called_once()

    @pytest.mark.asyncio
    async def test_disabled_feature(self, in_memory_application_database: AsyncIOMotorDatabase):
        # GIVEN a random test feature is initialized,
        # AND the feature is disabled in the application config

        given_feature_id = f'test_feature_{uuid4()}'
        mock_application_config = Mock()
        mock_application_config.features = {
            given_feature_id: Mock(
                enabled=False,
                class_path='test_module',
                class_name='TestFeature',
                feature_name='Test Feature',
                config={"some_config_key": "some_config_value"}
            )
        }

        # AND a FeatureConfig class is defined in the module
        mock_feature_instance = Mock()
        mock_feature_module = Mock()
        mock_feature_module.TestFeature = Mock(return_value=mock_feature_instance)

        # AND the import lib will return the mocked module
        patch('importlib.import_module', return_value=mock_feature_module)
        # WHEN the feature loader is initialized
        loader = FeatureLoader(mock_application_config)

        # THEN the feature.__init__ method should be called
        mock_feature_module.TestFeature.assert_not_called()

        # AND the feature should not be added to `enabled_features`.
        assert len(loader.enabled_features) == 0

        # WHEN the feature loader is initialized (calling init method)
        await loader.init(in_memory_application_database)

        # THEN the mock_feature_module.TestFeature.init should be called with the correct config and database
        mock_feature_instance.init.assert_not_called()

        # WHEN the feature loader is torn down
        await loader.tear_down()

        # THEN the mock_feature_module.TestFeature.tear_down should be called
        mock_feature_instance.tear_down.assert_not_called()

    @pytest.mark.asyncio
    async def test_init_throws_an_error(self, in_memory_application_database: AsyncIOMotorDatabase,
                                        caplog: pytest.LogCaptureFixture):
        # GIVEN a random test feature is initialized,
        # AND the feature is enabled in the application config

        given_feature_id = f'test_feature_{uuid4()}'
        mock_application_config = Mock()
        mock_application_config.features = {
            given_feature_id: Mock(
                enabled=True,
                class_path='test_module',
                class_name='TestFeature',
                feature_name='Test Feature',
                config={"some_config_key": "some_config_value"}
            )
        }

        # AND a FeatureConfig class is defined in the module
        mock_feature_instance = Mock()
        mock_feature_instance.init.side_effect = Exception("Initialization error")
        mock_feature_module = Mock()
        mock_feature_module.TestFeature = Mock(return_value=mock_feature_instance)

        # AND the import lib will return the mocked module
        with patch('importlib.import_module', return_value=mock_feature_module):
            # WHEN the feature loader is initialized
            loader = FeatureLoader(mock_application_config)

            # THEN the feature.__init__ method should be called
            mock_feature_module.TestFeature.assert_called_once()

            # WHEN the feature loader is initialized (calling init method)
            await loader.init(in_memory_application_database)

            # THEN the mock_feature_module.TestFeature.init should be called with the correct config and database
            mock_feature_instance.init.assert_called_once_with(
                mock_application_config.features[given_feature_id].config,
                in_memory_application_database
            )

            # AND the exception should be logged, but not raised
            # (this is handled in the _init_feature method)
            assert "Error initializing feature Test Feature: Initialization error" in caplog.text

            # WHEN the feature loader is torn down
            await loader.tear_down()

            # THEN the mock_feature_module.TestFeature.tear_down should be called
            mock_feature_instance.tear_down.assert_called_once()


class TestLoaderIntegrationTests:
    # GIVEN a feature id
    given_feature_id = f'test_feature_{uuid4()}'

    # on a test startup we need to set up the env variables
    # on cleanup we need to remove the env variables
    @pytest.fixture(scope="function")
    def enable_test_feature(self):
        setup_env_vars(env_vars={
            "BACKEND_FEATURES": f"""
                {{
                    "{self.given_feature_id}": {{
                        "enabled": true,
                        "class_path": "features.test_loader",
                        "class_name": "_TestFeature",
                        "feature_name": "Test Feature",
                        "config": {{"some_config_key": "some_config_value"}}
                    }}
                }}
            """
        })

        yield

        teardown_env_vars()

    @pytest.mark.asyncio
    async def test_feature_up(self,
                              in_memory_application_database: Awaitable[AsyncIOMotorDatabase],
                              in_memory_taxonomy_database: Awaitable[AsyncIOMotorDatabase],
                              in_memory_userdata_database: Awaitable[AsyncIOMotorDatabase],
                              in_memory_metrics_database: Awaitable[AsyncIOMotorDatabase],
                              mocker: pytest_mock.MockFixture,
                              enable_test_feature: None
                              ):
        """
        Integration test for the backend server application for the feature loader.
        It will spin up the FastAPI application with an in memory db for the application db and that custom features are loaded.
        """

        # Clear the cache before starting the test
        CompassDBProvider.clear_cache()

        mocker.patch('app.vector_search.validate_taxonomy_model.validate_taxonomy_model', return_value=None)
        app_module = importlib.import_module("app.server")
        importlib.reload(app_module)

        app = app_module.app
        lifespan = app_module.lifespan

        _in_mem_application_db = mocker.patch('app.server_dependencies.db_dependencies._get_application_db',
                                              return_value=await in_memory_application_database)
        _in_mem_taxonomy_db = mocker.patch('app.server_dependencies.db_dependencies._get_taxonomy_db',
                                           return_value=await in_memory_taxonomy_database)
        _in_mem_userdata_db = mocker.patch('app.server_dependencies.db_dependencies._get_userdata_db',
                                           return_value=await in_memory_userdata_database)
        _in_mem_metrics_db = mocker.patch('app.server_dependencies.db_dependencies._get_metrics_db',
                                          return_value=await in_memory_metrics_database)

        feature_module = Mock()
        feature_module.TestFeature = _TestFeature

        async with lifespan(app):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:  # noqa
                """
                Test the version endpoint
                :return:
                """
                # GIVEN the FastAPI application is running
                app.state = cast(State, app.state)
                await app.state.startup_complete.wait()
                print("Application startup complete, running tests...")
                # WHEN a GET request is made to the version endpoint
                response = await c.get("/features/health")
                # THEN it should return with OK
                assert response.status_code == 200
                # AND the response should be a JSON object
                assert response.json() is not None
                # AND the feature should be up in the feature health response.
                features_health = response.json()
                assert features_health[self.given_feature_id] == "up"

                # AND when the feature's health endpoint is called
                response = await c.get(f"/features/{self.given_feature_id}/test-feature/health")
                # THEN it should return with OK
                assert response.status_code == 200

                # AND the response should be a JSON object
                assert response.json() == {"status": "healthy"}
