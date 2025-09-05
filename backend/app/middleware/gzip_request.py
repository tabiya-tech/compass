import gzip
import logging
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

class GZipRequestMiddleware(BaseHTTPMiddleware):
    """
    Middleware to decompress gzip-compressed request bodies.
    """
    
    async def dispatch(self, request: Request, call_next):
        content_encoding = request.headers.get("content-encoding")

        # Only process gzip-compressed requests
        if content_encoding == "gzip":
            try:
                body = await request.body()
                if body:
                    # Decompress the gzip-compressed body
                    decompressed_body = gzip.decompress(body)

                    # Replace the request body with the decompressed content
                    request._body = decompressed_body
            except gzip.BadGzipFile as e:
                logger.warning(f"Invalid gzip data received: {e}")
                raise HTTPException(
                    status_code=400, 
                    detail="Invalid gzip compression format"
                )
            except Exception as e:
                logger.error(f"Failed to decompress gzip body: {e}")
                raise HTTPException(
                    status_code=400, 
                    detail="Failed to decompress request body"
                )

        # Proceed with the next middleware or route handler
        response = await call_next(request)
        return response
