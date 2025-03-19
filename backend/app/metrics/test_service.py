import pytest
from unittest.mock import AsyncMock

from app.metrics.repository import IMetricsRepository
from app.metrics.types import AbstractCompassMetricEvent, EventType
from app.metrics.service import MetricsService
from app.app_config import ApplicationConfig


@pytest.fixture(scope="function")
def _mock_metrics_repository() -> IMetricsRepository:
    class MockMetricsRepository(IMetricsRepository):
        async def record_event(self, event: AbstractCompassMetricEvent):
            raise NotImplementedError()

        def _to_db_doc(self, event: AbstractCompassMetricEvent):
            raise NotImplementedError()

    return MockMetricsRepository()


def _get_metric_event() -> AbstractCompassMetricEvent:
    class _FooEvent(AbstractCompassMetricEvent):
        # add some random fields
        foo: str

        def __init__(self, foo: str):
            super().__init__(
                foo=foo,
                event_type=EventType.USER_ACCOUNT_CREATED,
            )

    return _FooEvent(
        foo="foo-id"
    )


class TestMetricsService:
    @pytest.mark.asyncio
    async def test_record_event(self, _mock_metrics_repository: IMetricsRepository, setup_application_config: ApplicationConfig):
        # GIVEN a metric to record
        given_metric_event = _get_metric_event()

        #  AND the metrics repository will record the event successfully
        _mock_metrics_repository.record_event = AsyncMock(return_value=True)

        # WHEN the event is recorded
        service = MetricsService(_mock_metrics_repository)
        await service.record_event(given_metric_event)

        # THEN the repository is called with the event
        _mock_metrics_repository.record_event.assert_called_once_with([given_metric_event])

    @pytest.mark.asyncio
    async def test_record_event_handles_repository_error(self, _mock_metrics_repository: IMetricsRepository,
                                                         setup_application_config: ApplicationConfig,
                                                         caplog: pytest.LogCaptureFixture):
        # GIVEN a metric to record
        metric_event = _get_metric_event()

        # AND the metrics repository will raise an exception
        given_exception = Exception("foo error")
        _mock_metrics_repository.record_event = AsyncMock(side_effect=given_exception)

        # WHEN the event is recorded
        service = MetricsService(_mock_metrics_repository)
        await service.record_event(metric_event)  # no exception is thrown

        # THEN the repository was called with the event
        _mock_metrics_repository.record_event.assert_called_once_with([metric_event])

        # AND the error is logged
        assert str(given_exception) in caplog.text
