import gzip
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

class GZipRequestMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Check if the request body is gzip-compressed
        if request.headers.get("content-encoding") == "gzip":
            try:
                body = await request.body()
                if body:
                    # Decompress the gzip-compressed body
                    decompressed_body = gzip.decompress(body)

                    # Replace the request body with the decompressed content
                    request._body = decompressed_body
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to decompress gzip body: {str(e)}")

        # Proceed with the next middleware or route handler
        response = await call_next(request)
        return response