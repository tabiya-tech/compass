import pytest
from unittest.mock import AsyncMock

from app.metrics.repository.repository import IMetricsRepository
from app.metrics.types import AbstractCompassMetricEvent, EventType, AbstractUserAccountEvent
from app.metrics.services.service import MetricsService
from app.app_config import ApplicationConfig
from app.users.repositories import IUserPreferenceRepository
from common_libs.test_utilities import get_random_printable_string


@pytest.fixture(scope="function")
def _mock_metrics_repository() -> IMetricsRepository:
    class MockMetricsRepository(IMetricsRepository):
        async def record_event(self, event: AbstractCompassMetricEvent):
            raise NotImplementedError()

        def _to_db_doc(self, event: AbstractCompassMetricEvent):
            raise NotImplementedError()

    return MockMetricsRepository()


@pytest.fixture(scope="function")
def _mock_user_preference_repository() -> IUserPreferenceRepository:
    class MockUserPreferenceRepository(IUserPreferenceRepository):
        async def get_user_preference_by_user_id(self, user_id: str):
            raise NotImplementedError()

        async def get_experiments_by_user_id(self, user_id: str) -> dict[str, str]:
            raise NotImplementedError()

        async def set_experiment_by_user_id(self, user_id: str, experiment_id: str, experiment_class: str) -> None:
            raise NotImplementedError()

        async def insert_user_preference(self, user_id: str, user_preference):
            raise NotImplementedError()

        async def update_user_preference(self, user_id: str, update):
            raise NotImplementedError()

    return MockUserPreferenceRepository()


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


def _get_user_account_event() -> AbstractUserAccountEvent:
    class _FooUserAccountEvent(AbstractUserAccountEvent):
        def __init__(self, user_id: str):
            super().__init__(
                user_id=user_id,
                event_type=EventType.USER_ACCOUNT_CREATED,
            )

    return _FooUserAccountEvent(
        user_id="user-id"
    )


class TestMetricsService:
    class TestRecordEvent:
        @pytest.mark.asyncio
        async def test_record_event(self, _mock_metrics_repository: IMetricsRepository, _mock_user_preference_repository: IUserPreferenceRepository, setup_application_config: ApplicationConfig):
            # GIVEN a metric to record
            given_metric_event = _get_metric_event()

            # AND a user id
            given_user_id = get_random_printable_string(10)

            #  AND the metrics repository will record the event successfully
            _mock_metrics_repository.record_event = AsyncMock(return_value=True)

            # WHEN the event is recorded with metrics enabled
            service = MetricsService(_mock_metrics_repository, _mock_user_preference_repository, True)
            await service.record_event(given_metric_event, given_user_id)

            # THEN the repository is called with the event
            _mock_metrics_repository.record_event.assert_called_once_with([given_metric_event])

        @pytest.mark.asyncio
        async def test_record_event_handles_repository_error(self, _mock_metrics_repository: IMetricsRepository, _mock_user_preference_repository: IUserPreferenceRepository,
                                                             setup_application_config: ApplicationConfig,
                                                             caplog: pytest.LogCaptureFixture):
            # GIVEN a metric to record
            metric_event = _get_metric_event()

            # AND a user id
            given_user_id = get_random_printable_string(10)

            # AND the metrics repository will raise an exception
            given_exception = Exception("foo error")
            _mock_metrics_repository.record_event = AsyncMock(side_effect=given_exception)

            # WHEN the event is recorded with metrics enabled
            service = MetricsService(_mock_metrics_repository, _mock_user_preference_repository, True)
            await service.record_event(metric_event, given_user_id)  # no exception is thrown

            # THEN the repository was called with the event
            _mock_metrics_repository.record_event.assert_called_once_with([metric_event])

            # AND the error is logged
            assert str(given_exception) in caplog.text

        @pytest.mark.asyncio
        async def test_record_user_account_event_sets_experiments(self, _mock_metrics_repository: IMetricsRepository, _mock_user_preference_repository: IUserPreferenceRepository,
                                                                  setup_application_config: ApplicationConfig):
            # GIVEN a user account event to record
            given_user_account_event = _get_user_account_event()

            # AND a user id
            given_user_id = get_random_printable_string(10)

            # AND the user preferences repository will return some experiments
            given_experiments = {"experiment1": "group1", "experiment2": "group2"}
            _mock_user_preference_repository.get_experiments_by_user_id = AsyncMock(return_value=given_experiments)

            # AND the metrics repository will record the event successfully
            _mock_metrics_repository.record_event = AsyncMock(return_value=True)

            # WHEN the event is recorded with metrics enabled
            service = MetricsService(_mock_metrics_repository, _mock_user_preference_repository, True)
            await service.record_event(given_user_account_event, given_user_id)

            # THEN the repository is called with the event
            _mock_metrics_repository.record_event.assert_called_once_with([given_user_account_event])

            # AND the experiments are set on the event
            assert given_user_account_event.relevant_experiments == given_experiments

        @pytest.mark.asyncio
        async def test_should_not_record_event_when_metrics_disabled(self, _mock_metrics_repository: IMetricsRepository, _mock_user_preference_repository: IUserPreferenceRepository,
                                                                     setup_application_config: ApplicationConfig,
                                                                     caplog: pytest.LogCaptureFixture):
            # GIVEN a metric to record
            metric_event = _get_metric_event()

            # AND a user id
            given_user_id = get_random_printable_string(10)

            #  AND the metrics repository will record the event successfully if called
            _mock_metrics_repository.record_event = AsyncMock(return_value=True)

            # WHEN the event is recorded with metrics disabled
            service = MetricsService(_mock_metrics_repository, _mock_user_preference_repository, False)
            await service.record_event(metric_event, given_user_id)

            # THEN the repository is not called
            _mock_metrics_repository.record_event.assert_not_called()

            # AND a warning is logged
            assert "Metrics are disabled. Events will not be recorded." in caplog.text

    class TestBulkRecordEvents:
        @pytest.mark.asyncio
        async def test_bulk_record_events(self, _mock_metrics_repository: IMetricsRepository, _mock_user_preference_repository: IUserPreferenceRepository, setup_application_config: ApplicationConfig):
            # GIVEN metrics to record of given size
            given_number = 10
            given_metric_events = [_get_metric_event() for _ in range(given_number)]

            # AND a user id
            given_user_id = get_random_printable_string(10)

            #  AND the metrics repository will record the event successfully
            _mock_metrics_repository.record_event = AsyncMock(return_value=True)

            # WHEN the events are recorded with metrics enabled
            service = MetricsService(_mock_metrics_repository, _mock_user_preference_repository, True)
            await service.bulk_record_events(given_metric_events, given_user_id)

            # THEN the repository will be called with the events
            _mock_metrics_repository.record_event.assert_called_once_with(given_metric_events)

        @pytest.mark.asyncio
        async def test_bulk_record_events_handles_repository_error(self, _mock_metrics_repository: IMetricsRepository, _mock_user_preference_repository: IUserPreferenceRepository,
                                                                   setup_application_config: ApplicationConfig,
                                                                   caplog: pytest.LogCaptureFixture):
            # GIVEN metrics to record of given size
            given_number = 10
            given_metric_events = [_get_metric_event() for _ in range(given_number)]


            # AND a user id
            given_user_id = get_random_printable_string(10)

            # AND the metrics repository will raise an exception
            given_exception = Exception("foo error")
            _mock_metrics_repository.record_event = AsyncMock(side_effect=given_exception)

            # WHEN the events are recorded with metrics enabled
            service = MetricsService(_mock_metrics_repository, _mock_user_preference_repository, True)
            await service.bulk_record_events(given_metric_events, given_user_id)  # no exception is thrown

            # THEN the repository will be called with the events
            _mock_metrics_repository.record_event.assert_called_once_with(given_metric_events)

            # AND the error is logged
            assert str(given_exception) in caplog.text

        @pytest.mark.asyncio
        async def test_should_not_record_events_when_metrics_disabled(self, _mock_metrics_repository: IMetricsRepository, _mock_user_preference_repository: IUserPreferenceRepository,
                                                                      setup_application_config: ApplicationConfig,
                                                                      caplog: pytest.LogCaptureFixture):
            # GIVEN metrics to record of given size
            given_number = 10
            given_metric_events = [_get_metric_event() for _ in range(given_number)]

            # AND a user id
            given_user_id = get_random_printable_string(10)

            #  AND the metrics repository will record the event successfully if called
            _mock_metrics_repository.record_event = AsyncMock(return_value=True)

            # WHEN the events are recorded with metrics disabled
            service = MetricsService(_mock_metrics_repository, _mock_user_preference_repository, False)
            await service.bulk_record_events(given_metric_events, given_user_id)

            # THEN the repository will not be called
            _mock_metrics_repository.record_event.assert_not_called()

            # AND a warning is logged
            assert "Metrics are disabled. Events will not be recorded." in caplog.text

        @pytest.mark.asyncio
        async def test_should_not_record_events_when_empty_events_passed(self, _mock_metrics_repository: IMetricsRepository, _mock_user_preference_repository: IUserPreferenceRepository,
                                                                      setup_application_config: ApplicationConfig,
                                                                      caplog: pytest.LogCaptureFixture):
            # GIVEN empty metric events
            given_metric_events = []

            # AND a user id
            given_user_id = get_random_printable_string(10)

            #  AND the metrics repository will record the event successfully if called
            _mock_metrics_repository.record_event = AsyncMock(return_value=True)

            # WHEN the events are recorded with the metrics Enabled
            service = MetricsService(_mock_metrics_repository, _mock_user_preference_repository, True)
            await service.bulk_record_events(given_metric_events, given_user_id)

            # THEN the repository should not be called
            _mock_metrics_repository.record_event.assert_not_called()
