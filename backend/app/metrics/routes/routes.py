"""
This module contains functions to add metrics routes to the app router.
"""
import logging
from http import HTTPStatus
from typing import Any

from app.metrics.utils import decrypt_event_payload

from app.metrics.routes.types import MetricsRequestBody

from app.users.auth import Authentication, UserInfo

from app.constants.errors import HTTPErrorResponse
from fastapi import HTTPException
from app.metrics.services.get_metrics_service import get_metrics_service
from app.metrics.services.service import IMetricsService
from fastapi import APIRouter, Depends, FastAPI

from app.metrics.constants import EventType
from app.metrics.types import AbstractCompassMetricEvent, CVDownloadedEvent, DeviceSpecificationEvent, \
    DemographicsEvent, UserLocationEvent, NetworkInformationEvent


logger = logging.getLogger(__name__)


def _construct_metric_event(_event_data: Any) -> AbstractCompassMetricEvent:
    """Constructs the appropriate metric event based on the event type"""
    # Convert the request to a dict and remove event_type
    event_type = _event_data.pop("event_type")
    event_data = _event_data

    if event_type == EventType.CV_DOWNLOADED.value:
        return CVDownloadedEvent(**event_data)
    elif event_type == EventType.DEMOGRAPHICS.value:
        return DemographicsEvent(**event_data)
    elif event_type == EventType.USER_LOCATION.value:
        return UserLocationEvent(**event_data)
    elif event_type == EventType.DEVICE_SPECIFICATION.value:
        return DeviceSpecificationEvent(**event_data)
    elif event_type == EventType.NETWORK_INFORMATION.value:
        return NetworkInformationEvent(**event_data)
    else:
        raise ValueError(f"Unknown event type: {event_type}")


def add_metrics_routes(app_router: FastAPI, auth: Authentication):
    """
    Add all routes related to metrics
    :param auth: Authentication Provider
    :param app_router: FastAPI: The router to add the metrics routes to.
    """
    router = APIRouter(prefix="/metrics", tags=["metrics"])

    @router.post("",
                 status_code=HTTPStatus.ACCEPTED,
                 responses={
                      HTTPStatus.BAD_REQUEST: {"model": HTTPErrorResponse},
                 },
                 name="create metric event",
                 description="create metrics for various events"
                 )
    async def _metrics_handler(
            request_body: MetricsRequestBody,
            metrics_service: IMetricsService = Depends(get_metrics_service),
            user_info: UserInfo = Depends(auth.get_user_info())
    ) -> None:
        """
        Creates or updates metrics for a session.

        :param request_body: The request body
        :param metrics_service: Service for managing user metrics
        :return: None
        """

        events: list[AbstractCompassMetricEvent] = []
        construction_errors: list[str] = []

        # Decrypt the metric events payload.
        metrics_requests: list[Any] = decrypt_event_payload(request_body.payload, user_info)

        # construct events
        for metrics_request in metrics_requests:
            try:
                event = _construct_metric_event(metrics_request)
                events.append(event)
            except ValueError as e:
                logger.exception(e)
                construction_errors.append(str(e))
        
        # record successfully constructed events
        for event in events:
            try:
                await metrics_service.record_event(event)
            except Exception as e:
                # we dont respond to the user with any HTTP error code as this endpoint should be
                # fire-and-forget, we simply log the error and move on
                logger.exception(e)
        
        # for the events that failed to construct, raise an HTTP exception
        if construction_errors:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"Failed to construct events: {'; '.join(construction_errors)}"
            )

    ######################
    # Add the metrics router to the app router
    ######################
    app_router.include_router(router)
