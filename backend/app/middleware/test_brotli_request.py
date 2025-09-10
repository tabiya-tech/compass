import pytest
import brotli
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import FastAPI, Request, HTTPException
from fastapi.testclient import TestClient
from app.middleware.brotli_request import BrotliRequestMiddleware


@pytest.fixture
def app():
    """Create a test FastAPI app with the BrotliRequestMiddleware."""
    app = FastAPI()
    app.add_middleware(BrotliRequestMiddleware)
    
    @app.post("/test")
    async def test_endpoint(request: Request):
        body = await request.body()
        return {"body_length": len(body), "body_content": body.decode('utf-8', errors='ignore')}
    
    return app


@pytest.fixture
def client(app):
    """Create a test client for the app."""
    return TestClient(app)


class TestBrotliRequestMiddleware:
    """Test cases for BrotliRequestMiddleware."""

    def test_no_compression_header_passes_through(self, client):
        """Test that requests without compression headers pass through unchanged."""
        # GIVEN a request without compression
        test_data = b"Hello, World!"
        
        # WHEN making a request without Content-Encoding header
        response = client.post("/test", content=test_data)
        
        # THEN the request should pass through unchanged
        assert response.status_code == 200
        result = response.json()
        assert result["body_length"] == len(test_data)
        assert result["body_content"] == test_data.decode('utf-8')

    def test_brotli_compression_decompresses_correctly(self, client):
        """Test that brotli-compressed requests are decompressed correctly."""
        # GIVEN a request with brotli compression
        original_data = b"Hello, World! This is a test message for brotli compression."
        compressed_data = brotli.compress(original_data)
        
        # WHEN making a request with Content-Encoding: br
        response = client.post(
            "/test", 
            content=compressed_data,
            headers={"Content-Encoding": "br"}
        )
        
        # THEN the request should be decompressed
        assert response.status_code == 200
        result = response.json()
        assert result["body_length"] == len(original_data)
        assert result["body_content"] == original_data.decode('utf-8')

    def test_large_brotli_compression(self, client):
        """Test that large brotli-compressed requests are handled correctly."""
        # GIVEN a large request with brotli compression
        original_data = b"Large test data: " + b"x" * 10000
        compressed_data = brotli.compress(original_data)
        
        # WHEN making a request with Content-Encoding: br
        response = client.post(
            "/test", 
            content=compressed_data,
            headers={"Content-Encoding": "br"}
        )
        
        # THEN the request should be decompressed correctly
        assert response.status_code == 200
        result = response.json()
        assert result["body_length"] == len(original_data)
        assert result["body_content"] == original_data.decode('utf-8')

    def test_invalid_brotli_data_returns_400(self, client):
        """Test that invalid brotli data returns a 400 error."""
        # GIVEN invalid brotli data
        invalid_data = b"This is not valid brotli compressed data"
        
        # WHEN making a request with Content-Encoding: br
        response = client.post(
            "/test", 
            content=invalid_data,
            headers={"Content-Encoding": "br"}
        )
        
        # THEN the request should return 400
        assert response.status_code == 400
        assert "Invalid brotli compression format" in response.json()["detail"]

    def test_empty_brotli_request_handled_gracefully(self, client):
        """Test that empty brotli requests are handled gracefully."""
        # GIVEN an empty request with brotli compression
        empty_data = b""
        
        # WHEN making a request with Content-Encoding: br
        response = client.post(
            "/test", 
            content=empty_data,
            headers={"Content-Encoding": "br"}
        )
        
        # THEN the request should pass through unchanged
        assert response.status_code == 200
        result = response.json()
        assert result["body_length"] == 0

    def test_other_compression_headers_ignored(self, client):
        """Test that other compression headers (like gzip) are ignored."""
        # GIVEN a request with gzip compression header
        test_data = b"Hello, World!"
        
        # WHEN making a request with Content-Encoding: gzip
        response = client.post(
            "/test", 
            content=test_data,
            headers={"Content-Encoding": "gzip"}
        )
        
        # THEN the request should pass through unchanged (not decompressed)
        assert response.status_code == 200
        result = response.json()
        assert result["body_length"] == len(test_data)
        assert result["body_content"] == test_data.decode('utf-8')

    def test_middleware_preserves_other_headers(self, client):
        """Test that the middleware preserves other request headers."""
        # GIVEN a request with brotli compression and other headers
        original_data = b"Test data with headers"
        compressed_data = brotli.compress(original_data)
        
        # WHEN making a request with multiple headers
        response = client.post(
            "/test", 
            content=compressed_data,
            headers={
                "Content-Encoding": "br",
                "Authorization": "Bearer test-token",
                "X-Custom-Header": "custom-value"
            }
        )
        
        # THEN the request should be processed successfully
        assert response.status_code == 200
        result = response.json()
        assert result["body_length"] == len(original_data)

    def test_middleware_handles_unicode_data(self, client):
        """Test that the middleware handles unicode data correctly."""
        # GIVEN a request with unicode data and brotli compression
        original_data = "Hello, 世界! 🌍 This is a test with unicode characters.".encode('utf-8')
        compressed_data = brotli.compress(original_data)
        
        # WHEN making a request with Content-Encoding: br
        response = client.post(
            "/test", 
            content=compressed_data,
            headers={"Content-Encoding": "br"}
        )
        
        # THEN the request should be decompressed correctly
        assert response.status_code == 200
        result = response.json()
        assert result["body_length"] == len(original_data)
        assert result["body_content"] == original_data.decode('utf-8')

    def test_middleware_handles_json_data(self, client):
        """Test that the middleware handles JSON data correctly."""
        # GIVEN a JSON request with brotli compression
        json_data = '{"message": "Hello, World!", "number": 42, "array": [1, 2, 3]}'
        original_data = json_data.encode('utf-8')
        compressed_data = brotli.compress(original_data)
        
        # WHEN making a request with Content-Encoding: br
        response = client.post(
            "/test", 
            content=compressed_data,
            headers={"Content-Encoding": "br"}
        )
        
        # THEN the request should be decompressed correctly
        assert response.status_code == 200
        result = response.json()
        assert result["body_length"] == len(original_data)
        assert result["body_content"] == json_data
