"""
This module contains functions to add metrics routes to the app router.
"""
import logging
from http import HTTPStatus

from app.constants.errors import HTTPErrorResponse
from fastapi import Request, HTTPException
from app.metrics.services.get_metrics_service import get_metrics_service
from app.metrics.services.service import IMetricsService
from fastapi import APIRouter, Depends, FastAPI
from pydantic import BaseModel, Field

from app.metrics.constants import EventType
from app.metrics.types import AbstractCompassMetricEvent, CVDownloadedEvent, DeviceSpecificationEvent, \
    DemographicsEvent, UserLocationEvent, NetworkInformationEvent


class _PayloadTooLargeErrorResponse(HTTPErrorResponse):
    """
    Response model for payload size validation errors.
    """
    detail: str = Field(
        description="Error message indicating which field exceeded the size limit",
    )

logger = logging.getLogger(__name__)

# Maximum allowed payload size in characters (1KB)
# CVDownloadedEvent: Estimate: 20 (user_id) + 8 (int) + 3 (format) + overhead ≈ 60–100 bytes
# DemographicsEvent: Estimate: 20 (user_id) + 3 (age) + 10 (gender) + 20 (education) + 50 (employment) + overhead ≈ 100–200 bytes
# UserLocationEvent: Estimate: 20 + 16 (coords) + overhead ≈ 60–100 bytes
# DeviceSpecificationEvent: Estimate: 20 (user_id) + 20 (device) + 20 (os) + 20 (browser) + 20 (screen) + overhead ≈ 100–200 bytes
# single event size ≈ 100–200 bytes, 1KB ≈ 5–10 events
MAX_PAYLOAD_SIZE = 1024


class _MetricRequest(BaseModel):
    """Request type for metrics endpoint"""
    event_type: EventType

    class Config:
        extra = "allow"


def _construct_metric_event(request: _MetricRequest) -> AbstractCompassMetricEvent:
    """Constructs the appropriate metric event based on the event type"""
    # Convert the request to a dict and remove event_type
    event_data = request.model_dump(exclude={'event_type'})

    if request.event_type == EventType.CV_DOWNLOADED:
        return CVDownloadedEvent(**event_data)
    elif request.event_type == EventType.DEMOGRAPHICS:
        return DemographicsEvent(**event_data)
    elif request.event_type == EventType.USER_LOCATION:
        return UserLocationEvent(**event_data)
    elif request.event_type == EventType.DEVICE_SPECIFICATION:
        return DeviceSpecificationEvent(**event_data)
    elif request.event_type == EventType.NETWORK_INFORMATION:
        return NetworkInformationEvent(**event_data)
    else:
        raise ValueError(f"Unknown event type: {request.event_type}")


def add_metrics_routes(app_router: FastAPI):
    """
    Add all routes related to metrics
    :param app_router: FastAPI: The router to add the metrics routes to.
    """
    router = APIRouter(prefix="/metrics", tags=["metrics"])

    @router.post("",
                 status_code=HTTPStatus.ACCEPTED,
                 responses={
                      HTTPStatus.REQUEST_ENTITY_TOO_LARGE: {"model": _PayloadTooLargeErrorResponse},
                      HTTPStatus.BAD_REQUEST: {"model": HTTPErrorResponse},
                 },
                 name="create metric event",
                 description="create metrics for various events"
                 )
    async def _metrics_handler(
            request: Request,
            metrics_requests: list[_MetricRequest],
            metrics_service: IMetricsService = Depends(get_metrics_service),
    ) -> None:
        """
        Creates or updates metrics for a session.

        :param metrics_requests: The metrics details
        :param metrics_service: Service for managing user metrics
        :return: None
        """
        if len(await request.body()) > MAX_PAYLOAD_SIZE:
            raise HTTPException(status_code=HTTPStatus.REQUEST_ENTITY_TOO_LARGE, detail=f"Payload size exceeds {MAX_PAYLOAD_SIZE} characters")
        
        events: list[AbstractCompassMetricEvent] = []
        construction_errors: list[str] = []
        
        # construct events
        for metrics_request in metrics_requests:
            try:
                event = _construct_metric_event(metrics_request)
                events.append(event)
            except (ValueError, TypeError) as e:
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
