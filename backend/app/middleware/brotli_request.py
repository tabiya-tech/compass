import logging

import brotli
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class BrotliRequestMiddleware(BaseHTTPMiddleware):
    """
    Middleware to decompress brotli-compressed request bodies.
    """

    async def dispatch(self, request: Request, call_next):
        content_encoding = request.headers.get("content-encoding")

        # Only process brotli-compressed requests
        if not content_encoding == "br":
            logger.debug("Request without brotli compression, passing through. %s",
                         {"content_encoding": content_encoding})
            return await call_next(request)
        try:
            body = await request.body()
            if body:
                # Decompress the brotli-compressed body
                decompressed_body = brotli.decompress(body)
                logger.debug("Decompressed brotli-compressed request body. %s",
                             {"body_length": len(body), "decompressed_length": len(decompressed_body),
                              "content_encoding": content_encoding})

                # Replace the request body with the decompressed content
                request._body = decompressed_body
        except brotli.error as e:
            logger.warning(f"Invalid brotli data received: {e}")
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid brotli compression format"}
            )
        except Exception as e:
            logger.error(f"Failed to decompress brotli body: {e}")
            return JSONResponse(
                status_code=400,
                content={"detail": "Failed to decompress request body"}
            )

        # Proceed with the next middleware or route handler
        response = await call_next(request)
        return response
