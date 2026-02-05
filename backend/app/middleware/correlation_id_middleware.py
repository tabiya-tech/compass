import logging
import uuid

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from app.context_vars import correlation_id_ctx_var

logger = logging.getLogger(__name__)


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """
    Middleware to generate or extract correlation IDs for request tracing.
    
    This middleware:
    - Generates a UUID4 correlation ID for each request if not provided
    - Reads from X-Correlation-ID header if present (for distributed tracing)
    - Sets correlation_id in context variable for logging
    - Adds X-Correlation-ID to response headers
    """

    async def dispatch(self, request: Request, call_next):
        # Try to get correlation ID from request header, otherwise generate a new one
        correlation_id = request.headers.get("x-correlation-id")
        
        if not correlation_id:
            # Generate a new UUID4 for this request
            correlation_id = str(uuid.uuid4())
            logger.debug("Generated new correlation ID: %s", correlation_id)
        else:
            logger.debug("Using correlation ID from request header: %s", correlation_id)
        
        # Set the correlation ID in the context variable so it's available throughout the request
        correlation_id_ctx_var.set(correlation_id)
        
        # Process the request
        response = await call_next(request)
        
        # Add the correlation ID to the response headers for tracing
        response.headers["X-Correlation-ID"] = correlation_id
        
        return response
