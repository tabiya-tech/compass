"""Single entry point for obtaining a `MatchingService`.

Callers should not construct concrete services directly; instead they should
call `get_matching_service()` so that swapping between v1 and v2 is a one-line
change in this file.
"""

from app.app_config import get_application_config
from app.matching.client import MatchingServiceClient
from app.matching.service import MatchingService

from app.matching.service_v1 import MatchingServiceV1
from app.matching.service_v2 import MatchingServiceV2

_matching_service: MatchingService | None = None


def get_matching_service() -> MatchingService:
    """Return the lazily-initialized matching service singleton.

    To switch the application to v2, swap `MatchingServiceV1` for `MatchingServiceV2`
    below.
    """
    global _matching_service

    if _matching_service is None:
        _app_config = get_application_config()
        matching_service_client = MatchingServiceClient(
            base_url=_app_config.matching_service_url,
            api_key=_app_config.matching_service_api_key,
        )
        _matching_service = MatchingServiceV2(matching_service_client)

    return _matching_service
