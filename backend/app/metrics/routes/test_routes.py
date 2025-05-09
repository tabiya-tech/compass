"""
Tests for the metrics routes
"""
from datetime import datetime, timezone
from http import HTTPStatus
import random
from typing import Generator

from common_libs.test_utilities import get_random_printable_string, get_random_user_id, get_random_session_id
from unittest.mock import AsyncMock

from app.app_config import ApplicationConfig
from app.metrics.constants import EventType
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.metrics.services.service import IMetricsService
from app.metrics.types import (
    AbstractCompassMetricEvent,
    CVDownloadedEvent,
    DemographicsEvent,
    DeviceSpecificationEvent,
    UserLocationEvent,
    UIInteractionEvent
)

from common_libs.test_utilities.mock_auth import MockAuth
from app.metrics.routes.routes import add_metrics_routes, MAX_PAYLOAD_SIZE
from app.metrics.services.get_metrics_service import get_metrics_service


def get_cv_downloaded_request() -> dict:
    """Helper method to create a CV downloaded event request"""
    return {
        "event_type": EventType.CV_DOWNLOADED.value,
        "user_id": get_random_user_id(),
        "session_id": get_random_session_id(),
        "cv_format": "PDF",
        "timestamp": datetime.now().isoformat()
    }


def get_demographics_request() -> dict:
    """Helper method to create a demographics event request"""
    return {
        "event_type": EventType.DEMOGRAPHICS.value,
        "user_id": get_random_user_id(),
        "age": get_random_printable_string(10),
        "gender": get_random_printable_string(10),
        "education": get_random_printable_string(10),
        "employment_status": get_random_printable_string(10)
    }


def get_device_specification_request() -> dict:
    """Helper method to create a device specification event request"""
    return {
        "event_type": EventType.DEVICE_SPECIFICATION.value,
        "user_id": get_random_user_id(),
        "device_type": get_random_printable_string(10),
        "os_type": get_random_printable_string(10),
        "browser_type": get_random_printable_string(10),
        "browser_version": get_random_printable_string(10),
        "user_agent": get_random_printable_string(10),
        "timestamp": datetime.now().isoformat()
    }


def get_network_information_request() -> dict:
    """Helper method to create a network information event request"""
    return {
        "event_type": EventType.NETWORK_INFORMATION.value,
        "user_id": get_random_user_id(),
        "session_id": get_random_session_id(),
        "effective_connection_type": get_random_printable_string(10),
    }


def get_user_location_request() -> dict:
    """Helper method to create a user location event request"""
    return {
        "event_type": EventType.USER_LOCATION.value,
        "user_id": get_random_user_id(),
        "coordinates": (random.uniform(-90.0, 90.0), random.uniform(-180.0, 180.0)), # nosec B311 # random is used for testing purposes
        "timestamp": datetime.now().isoformat()
    }


def get_ui_interaction_request() -> dict:
    """Helper method to create a UI interaction event request"""
    return {
        "event_type": EventType.UI_INTERACTION.value,
        "user_id": get_random_user_id(),
        "actions": [get_random_printable_string(10), get_random_printable_string(10)],
        "element_id": get_random_printable_string(10),
        "timestamp": datetime.now().isoformat(),
        "relevant_experiments": {"exp1": "group1", "exp2": "group2"}
    }


def assert_event_fields_match(event: AbstractCompassMetricEvent, request_data: dict) -> None:
    """
    Helper method to assert that all fields in the request match the event fields.
    Excludes event_type as it's handled separately.
    Verifies that anonymized IDs are different from original IDs.
    """
    for field, value in request_data.items():
        if field == 'event_type':
            continue

        if field == 'user_id':
            # Check that the anonymized_user_id is different from the original user_id
            assert event.anonymized_user_id != value
            continue

        if field == 'session_id':
            # Check that the anonymized_session_id is different from the original session_id
            assert event.anonymized_session_id != str(value)
            continue

        if field == 'timestamp':
            # Check that the string timestamp is converted to a datetime object with utc timezone
            assert event.timestamp == datetime.fromisoformat(value).astimezone(timezone.utc)
            continue

        # For all other fields, check direct equality
        assert getattr(event, field) == value


TestClientWithMocks = tuple[TestClient, IMetricsService]


def _create_test_client_with_mocks() -> TestClientWithMocks:
    """
    Factory function to create a test client with mocked dependencies
    """

    # Mock the metrics service
    class MockedMetricsService(IMetricsService):
        async def record_event(self, event: AbstractCompassMetricEvent) -> None:
            raise NotImplementedError()

    mocked_metrics_service = MockedMetricsService()

    # Set up the FastAPI app with the mocked dependencies
    app = FastAPI()

    # Set up the app dependency override
    app.dependency_overrides[get_metrics_service] = lambda: mocked_metrics_service

    # Add the metrics routes to the app
    add_metrics_routes(app)

    # Create a test client
    client = TestClient(app)

    return client, mocked_metrics_service


@pytest.fixture(scope='function')
def client_with_mocks() -> Generator[TestClientWithMocks, None, None]:
    """
    Returns a test client with authenticated mock auth
    """
    app = FastAPI()
    _instance_auth = MockAuth()
    client, service = _create_test_client_with_mocks()
    yield client, service
    app.dependency_overrides = {}


class TestMetricsRoutes:
    @pytest.mark.parametrize(
        "request_factory,event_class,event_type",
        [
            (get_cv_downloaded_request, CVDownloadedEvent, EventType.CV_DOWNLOADED),
            (get_demographics_request, DemographicsEvent, EventType.DEMOGRAPHICS),
            (get_device_specification_request, DeviceSpecificationEvent, EventType.DEVICE_SPECIFICATION),
            (get_user_location_request, UserLocationEvent, EventType.USER_LOCATION),
            (get_ui_interaction_request, UIInteractionEvent, EventType.UI_INTERACTION),
        ],
        ids=[
            "CV Downloaded",
            "Demographics",
            "Device Specification",
            "User Location",
            "UI Interaction"
        ]
    )
    @pytest.mark.asyncio
    async def test_record_single_metric_event_successful(
            self,
            client_with_mocks: TestClientWithMocks,
            setup_application_config: ApplicationConfig,
            request_factory: callable,
            event_class: type[AbstractCompassMetricEvent],
            event_type: EventType
    ):
        client, mocked_service = client_with_mocks
        # GIVEN a valid metric request
        given_metric_request = request_factory()

        # AND the service's record_event method is mocked to succeed
        mocked_service.record_event = AsyncMock()

        # WHEN a POST request is made with the metric request
        response = client.post(
            "/metrics",
            json=[given_metric_request],
        )

        # THEN the response is ACCEPTED
        assert response.status_code == HTTPStatus.ACCEPTED
        # AND the service's record_event method was called with the constructed event
        mocked_service.record_event.assert_called_once()
        # AND the event has the correct type and data
        event = mocked_service.record_event.call_args[0][0]
        assert isinstance(event, event_class)
        assert event.event_type == event_type
        assert_event_fields_match(event, given_metric_request)

    @pytest.mark.asyncio
    async def test_record_multiple_metric_events_successful(
            self,
            client_with_mocks: TestClientWithMocks,
            setup_application_config: ApplicationConfig
    ):
        client, mocked_service = client_with_mocks
        # GIVEN multiple valid metric requests
        given_metric_requests = [
            get_cv_downloaded_request(),
            get_demographics_request(),
            get_device_specification_request(),
            get_user_location_request(),
            get_ui_interaction_request()
        ]

        # AND the service's record_event method is mocked to succeed
        mocked_service.record_event = AsyncMock()

        # WHEN a POST request is made with the metric requests
        response = client.post(
            "/metrics",
            json=given_metric_requests,
        )

        # THEN the response is ACCEPTED
        assert response.status_code == HTTPStatus.ACCEPTED
        # AND the service's record_event method was called with the constructed events
        assert mocked_service.record_event.call_count == len(given_metric_requests)
        for event, request in zip(mocked_service.record_event.call_args_list, given_metric_requests):
            assert_event_fields_match(event[0][0], request)

    @pytest.mark.parametrize(
        "request_factory,event_class,event_type",
        [
            (get_cv_downloaded_request, CVDownloadedEvent, EventType.CV_DOWNLOADED),
            (get_demographics_request, DemographicsEvent, EventType.DEMOGRAPHICS),
            (get_device_specification_request, DeviceSpecificationEvent, EventType.DEVICE_SPECIFICATION),
            (get_user_location_request, UserLocationEvent, EventType.USER_LOCATION),
            (get_ui_interaction_request, UIInteractionEvent, EventType.UI_INTERACTION),
        ],
        ids=[
            "CV Downloaded",
            "Demographics",
            "Device Specification",
            "User Location",
            "UI Interaction"
        ]
    )
    @pytest.mark.asyncio
    async def test_record_metric_event_service_failure(
            self,
            client_with_mocks: TestClientWithMocks,
            setup_application_config: ApplicationConfig,
            request_factory: callable,
            event_class: type[AbstractCompassMetricEvent],
            event_type: EventType
    ):
        client, mocked_service = client_with_mocks
        # GIVEN a valid metric request
        given_metric_request = request_factory()

        # AND the service's record_event method is mocked to fail
        mocked_service.record_event = AsyncMock(side_effect=Exception("Service error"))

        # WHEN a POST request is made with the metric request
        response = client.post(
            "/metrics",
            json=[given_metric_request],
        )

        # THEN the response is still ACCEPTED despite service failure
        assert response.status_code == HTTPStatus.ACCEPTED
        # AND the service's record_event method was called with the constructed event
        mocked_service.record_event.assert_called_once()
        # AND the event has the correct type and data
        event = mocked_service.record_event.call_args[0][0]
        assert isinstance(event, event_class)
        assert event.event_type == event_type
        assert_event_fields_match(event, given_metric_request)

    @pytest.mark.asyncio
    async def test_record_metric_event_payload_too_large(
            self,
            client_with_mocks: TestClientWithMocks,
            setup_application_config: ApplicationConfig,
            caplog: pytest.LogCaptureFixture
    ):
        client, mocked_service = client_with_mocks
        # GIVEN a metric request with a payload that exceeds the maximum size
        given_metric_request = get_cv_downloaded_request()
        given_metric_request['user_id'] = get_random_printable_string(MAX_PAYLOAD_SIZE + 1)
        # AND the service's record_event method is mocked to succeed
        mocked_service.record_event = AsyncMock()

        # WHEN a POST request is made with the metric request
        response = client.post(
            "/metrics",
            json=[given_metric_request],
        )

        # THEN the response should be REQUEST_ENTITY_TOO_LARGE
        assert response.status_code == HTTPStatus.REQUEST_ENTITY_TOO_LARGE
        # AND the service's record_event method was not called
        mocked_service.record_event.assert_not_called()
        # AND the error is logged
        assert "Total payload size exceeds %s characters", MAX_PAYLOAD_SIZE in caplog.text
