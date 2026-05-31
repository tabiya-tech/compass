import logging
from typing import Generic, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.matching.matching_types import MatchingRequest


class MatchingServiceError(Exception):
    """Raised when a matching-service request fails (HTTP, transport, or response shape)."""


Response_ = TypeVar("Response_", bound=BaseModel)


class MatchingServiceClient:
    """Generic, transport-only client for the matching service.

    The caller supplies the response Pydantic model and the endpoint path, so this
    class can be reused across `/match`, `/match_v2`, etc. Authentication is via
    `x-api-key`.
    """

    def __init__(self, base_url: str, api_key: str, timeout: float = 30.0):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self._logger = logging.getLogger(self.__class__.__name__)

    async def process_request(self, response_cls: type[Response_], path: str, request: MatchingRequest) -> Response_:
        full_path = f"{self.base_url}{path}"
        self._logger.info(f"Sending request to {full_path}")
        # The matching service accepts a batch of users; we always send exactly one.
        request_json = [request.to_json()]
        # One-line summary of the BWS payload that was historically dropped before reaching
        # the matching service. Grep `[bws-payload]` to confirm the wire contract per session.
        _pv = request_json[0].get("preference_vector", {})
        _bws = _pv.get("bws_scores") or {}
        _top = _pv.get("top_10_bws") or []
        self._logger.info(
            "[bws-payload] user=%s bws_scores=%d top_10_bws=%d top3=%s",
            request.user_id, len(_bws), len(_top), _top[:3],
        )
        # Full payload at DEBUG only — contains skills/location, keep out of INFO logs.
        import json as _json
        self._logger.debug("[bws-payload] full: %s", _json.dumps(request_json[0], default=str))
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    full_path,
                    headers={
                        "x-api-key": self.api_key,
                        "Content-Type": "application/json"
                    },
                    json=request_json,
                    timeout=self.timeout
                )

                response.raise_for_status()

                result = response.json()

                self._logger.info(
                    f"Matching service returned successfully for user {request.user_id} "
                    f"(status={response.status_code})"
                )
                self._logger.debug(f"Matching service response: {result}")

                return response_cls.model_validate(result)

        except httpx.HTTPStatusError as e:
            self._logger.error(
                f"Matching service HTTP error for user {request.user_id}: "
                f"status={e.response.status_code}, body={e.response.text}"
            )
            raise MatchingServiceError(
                f"Matching service returned HTTP {e.response.status_code}: {e.response.text}"
            ) from e

        except httpx.RequestError as e:
            self._logger.error(
                f"Matching service request error for user {request.user_id}: {str(e)}"
            )
            raise MatchingServiceError(
                f"Failed to connect to matching service: {str(e)}"
            ) from e

        except ValidationError as e:
            self._logger.error(
                f"Matching service returned a response that does not match {response_cls.__name__} "
                f"for user {request.user_id}: {str(e)}"
            )
            raise MatchingServiceError(
                f"Matching service returned a response that does not match {response_cls.__name__}: {str(e)}"
            ) from e

        except MatchingServiceError:
            raise

        except Exception as e:
            self._logger.exception(
                f"Unexpected error calling matching service for user {request.user_id}"
            )
            raise MatchingServiceError(
                f"Unexpected matching service error: {str(e)}"
            ) from e
