import pytest
from unittest.mock import AsyncMock
from pytest_mock import MockerFixture
from datetime import datetime, timezone

from app.metrics.repository import ICompassMetricRepository
from app.metrics.types import CompassMetricEvent, EventType
from app.metrics.service import MetricsService
from app.app_config import ApplicationConfig


@pytest.fixture(scope="function")
def _mock_metrics_repository() -> ICompassMetricRepository:
    class MockMetricsRepository(ICompassMetricRepository):
        async def record_event(self, event: CompassMetricEvent):
            raise NotImplementedError()
        def _to_db_doc(self, event: CompassMetricEvent):
            raise NotImplementedError()
    return MockMetricsRepository()

def _get_metric_event():
    return CompassMetricEvent(
        event_type=EventType.USER_ACCOUNT_CREATED,
        event_type_name="USER_ACCOUNT_CREATED",
        version="test",
    )


class TestMetricsService:
    @pytest.mark.asyncio
    async def test_record_event(self, _mock_metrics_repository: ICompassMetricRepository, mocker: MockerFixture, setup_application_config: ApplicationConfig):
        # GIVEN a metric to record
        metric_event = _get_metric_event()

        #  AND the metrics repository will record the event successfully
        _mock_metrics_repository.record_event = AsyncMock(return_value=True)

        # AND datetime.now returns a fixed time
        fixed_time = datetime(2025, 3, 4, 6, 45, 0, tzinfo=timezone.utc)
        mocker.patch('common_libs.time_utilities._time_utils.datetime', new=mocker.Mock(now=lambda tz=None: fixed_time))

        # WHEN the event is recorded
        service = MetricsService(_mock_metrics_repository)
        await service.record_event(metric_event)

        # THEN the event is recorded with the correct environment name
        metric_event.environment_name = setup_application_config.environment_name

        # AND the repository is called with the event
        _mock_metrics_repository.record_event.assert_called_once_with([metric_event])
