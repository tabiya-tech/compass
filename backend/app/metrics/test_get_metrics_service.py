import asyncio

import pytest
import pytest_mock

from common_libs.test_utilities import get_random_application_config
from app.metrics.get_metrics_service import get_metrics_service


@pytest.mark.asyncio
class TestGetMetricsService:
    def teardown_method(self):
        import app.metrics.get_metrics_service
        app.metrics.get_metrics_service._metrics_service_singleton = None

    async def test_get_metrics_service_concurrent_calls(self, mocker: pytest_mock.MockFixture):
        # GIVEN random in-memory metrics database
        _in_memory_metrics_database = mocker.MagicMock()

        # AND given sample application config
        given_app_config = get_random_application_config()

        # WHEN get_metrics_service is called concurrently
        metrics_service_instance_1, metrics_service_instance_2 = await asyncio.gather(
            get_metrics_service(application_db=_in_memory_metrics_database, app_config=given_app_config),
            get_metrics_service(application_db=_in_memory_metrics_database, app_config=given_app_config)
        )

        # THEN the service should not be None and they should refer to the same instance.
        assert metrics_service_instance_1 is not None
        assert metrics_service_instance_2 is not None

        # And they should refer to the same service
        assert metrics_service_instance_1 == metrics_service_instance_2

        # AND it should connect to the right database.
        assert metrics_service_instance_1._metrics_repository.db == _in_memory_metrics_database  # type: ignore

        # AND the enable_metrics should be from application config
        assert metrics_service_instance_1.enable_metrics == given_app_config.enable_metrics  # type: ignore

    async def test_get_metrics_service_subsequent_calls(self, mocker: pytest_mock.MockFixture):
        # GIVEN random in-memory metrics database
        _in_memory_metrics_database = mocker.MagicMock()

        # AND given sample application config
        given_app_config = get_random_application_config()

        # WHEN get_metrics_service is called subsequently
        metrics_service_instance_1 = await get_metrics_service(
            application_db=_in_memory_metrics_database, app_config=given_app_config)

        metrics_service_instance_2 = await get_metrics_service(
            application_db=_in_memory_metrics_database, app_config=given_app_config)

        # THEN the service should not be None and they should refer to the same instance.
        assert metrics_service_instance_1 is not None
        assert metrics_service_instance_2 is not None

        # And they should refer to the same service
        assert metrics_service_instance_1 == metrics_service_instance_2

        # AND it should connect to the right database.
        assert metrics_service_instance_1._metrics_repository.db == _in_memory_metrics_database  # type: ignore

        # AND the enable_metrics should be from application config
        assert metrics_service_instance_1.enable_metrics == given_app_config.enable_metrics   # type: ignore
