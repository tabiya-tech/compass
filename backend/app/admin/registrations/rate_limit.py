"""
Simple in-memory per-IP sliding-window rate limiter for the public registration
endpoints.

Caveat: state lives in this process only — limits are per-replica, not global.
Acceptable for v1 expected signup volume; revisit (move to Redis) if traffic
grows or replicas > 1.
"""
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request, status

# Hardcoded limits (per IP, per minute)
REGISTRATION_RATE_LIMIT_PER_MIN = 5
STATUS_RATE_LIMIT_PER_MIN = 30

_WINDOW_SECONDS = 60

_buckets: dict[str, deque] = defaultdict(deque)
_lock = Lock()


def _client_ip(request: Request) -> str:
    """Resolve the client IP, honouring X-Forwarded-For when present (API Gateway)."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _check(key: str, limit: int) -> bool:
    """Return True if the request is allowed; record it if so."""
    now = time.monotonic()
    cutoff = now - _WINDOW_SECONDS
    with _lock:
        bucket = _buckets[key]
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= limit:
            return False
        bucket.append(now)
        return True


def make_rate_limiter(scope: str, limit_per_min: int):
    """Return a FastAPI dependency that 429s when the per-IP limit is exceeded."""
    def _dependency(request: Request) -> None:
        ip = _client_ip(request)
        if not _check(f"{scope}:{ip}", limit_per_min):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests, please try again later.",
            )
    return _dependency


registration_rate_limiter = make_rate_limiter("registration", REGISTRATION_RATE_LIMIT_PER_MIN)
status_rate_limiter = make_rate_limiter("registration_status", STATUS_RATE_LIMIT_PER_MIN)
