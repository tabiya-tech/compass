from fastapi import Depends

from app.application_state import ApplicationStateManager
from app.conversations.experience.service import IExperienceService, ExperienceService
from app.metrics.application_state_metrics_recorder.recorder import ApplicationStateMetricsRecorder
from app.metrics.services.get_metrics_service import get_metrics_service
from app.metrics.services.service import IMetricsService
from app.server_dependencies.application_state_dependencies import get_application_state_manager


def get_experience_service(
        application_state_manager: ApplicationStateManager = Depends(get_application_state_manager),
        metrics_service: IMetricsService = Depends(get_metrics_service)) -> IExperienceService:
    return ExperienceService(application_state_metrics_recorder=ApplicationStateMetricsRecorder(
        application_state_manager=application_state_manager,
        metrics_service=metrics_service))
