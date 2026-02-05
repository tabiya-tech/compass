import pytest
import uuid
from unittest.mock import patch
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from app.middleware.correlation_id_middleware import CorrelationIdMiddleware
from app.context_vars import correlation_id_ctx_var


@pytest.fixture
def app():
    """Create a test FastAPI app with the CorrelationIdMiddleware."""
    app = FastAPI()
    app.add_middleware(CorrelationIdMiddleware)
    
    @app.get("/test")
    async def test_endpoint():
        # Return the correlation ID from context to verify it was set
        return {"correlation_id": correlation_id_ctx_var.get()}
    
    @app.get("/test-headers")
    async def test_headers_endpoint(request: Request):
        # Return request headers and correlation ID from context
        return {
            "correlation_id_from_context": correlation_id_ctx_var.get(),
            "correlation_id_from_header": request.headers.get("x-correlation-id")
        }
    
    return app


@pytest.fixture
def client(app):
    """Create a test client for the app."""
    return TestClient(app)


class TestCorrelationIdMiddleware:
    """Test cases for CorrelationIdMiddleware."""

    def test_generates_correlation_id_if_not_provided(self, client):
        """Test that middleware generates a UUID4 correlation ID when not provided."""
        # WHEN making a request without X-Correlation-ID header
        response = client.get("/test")
        
        # THEN a correlation ID should be generated and set
        assert response.status_code == 200
        result = response.json()
        correlation_id = result["correlation_id"]
        
        # Verify it's a valid UUID4
        assert correlation_id != ":none:"
        try:
            uuid_obj = uuid.UUID(correlation_id, version=4)
            assert str(uuid_obj) == correlation_id
        except ValueError:
            pytest.fail(f"Generated correlation_id '{correlation_id}' is not a valid UUID4")
    
    def test_uses_correlation_id_from_header_if_provided(self, client):
        """Test that middleware uses X-Correlation-ID header if present."""
        # GIVEN a specific correlation ID
        expected_correlation_id = str(uuid.uuid4())
        
        # WHEN making a request with X-Correlation-ID header
        response = client.get(
            "/test",
            headers={"X-Correlation-ID": expected_correlation_id}
        )
        
        # THEN the provided correlation ID should be used
        assert response.status_code == 200
        result = response.json()
        assert result["correlation_id"] == expected_correlation_id
    
    def test_adds_correlation_id_to_response_headers(self, client):
        """Test that middleware adds X-Correlation-ID to response headers."""
        # WHEN making a request
        response = client.get("/test")
        
        # THEN X-Correlation-ID should be in response headers
        assert response.status_code == 200
        assert "x-correlation-id" in response.headers
        
        # Verify it matches the context value
        result = response.json()
        assert response.headers["x-correlation-id"] == result["correlation_id"]
    
    def test_response_header_matches_request_header(self, client):
        """Test that response header matches the provided request header."""
        # GIVEN a specific correlation ID in request
        expected_correlation_id = str(uuid.uuid4())
        
        # WHEN making a request with X-Correlation-ID header
        response = client.get(
            "/test",
            headers={"X-Correlation-ID": expected_correlation_id}
        )
        
        # THEN response should have the same correlation ID
        assert response.status_code == 200
        assert response.headers["x-correlation-id"] == expected_correlation_id
    
    def test_sets_correlation_id_in_context_variable(self, client):
        """Test that middleware sets correlation_id in context variable."""
        # GIVEN a specific correlation ID
        expected_correlation_id = str(uuid.uuid4())
        
        # WHEN making a request
        response = client.get(
            "/test",
            headers={"X-Correlation-ID": expected_correlation_id}
        )
        
        # THEN the correlation ID should be accessible in the context
        assert response.status_code == 200
        result = response.json()
        assert result["correlation_id"] == expected_correlation_id
    
    def test_handles_multiple_requests_with_different_correlation_ids(self, client):
        """Test that middleware handles multiple requests with different correlation IDs."""
        # GIVEN two different correlation IDs
        correlation_id_1 = str(uuid.uuid4())
        correlation_id_2 = str(uuid.uuid4())
        
        # WHEN making two separate requests
        response_1 = client.get(
            "/test",
            headers={"X-Correlation-ID": correlation_id_1}
        )
        response_2 = client.get(
            "/test",
            headers={"X-Correlation-ID": correlation_id_2}
        )
        
        # THEN each request should have its own correlation ID
        assert response_1.status_code == 200
        assert response_2.status_code == 200
        
        result_1 = response_1.json()
        result_2 = response_2.json()
        
        assert result_1["correlation_id"] == correlation_id_1
        assert result_2["correlation_id"] == correlation_id_2
        assert result_1["correlation_id"] != result_2["correlation_id"]
    
    def test_handles_case_insensitive_header(self, client):
        """Test that middleware handles X-Correlation-ID header case-insensitively."""
        # GIVEN a correlation ID with various header casings
        expected_correlation_id = str(uuid.uuid4())
        
        # WHEN making requests with different header casings
        for header_key in ["X-Correlation-ID", "x-correlation-id", "X-CORRELATION-ID"]:
            response = client.get(
                "/test-headers",
                headers={header_key: expected_correlation_id}
            )
            
            # THEN the correlation ID should be recognized
            assert response.status_code == 200
            result = response.json()
            assert result["correlation_id_from_context"] == expected_correlation_id
    
    def test_generates_unique_ids_for_parallel_requests(self, client):
        """Test that middleware generates unique correlation IDs for requests without headers."""
        # WHEN making multiple requests without correlation ID headers
        responses = [client.get("/test") for _ in range(5)]
        
        # THEN each request should have a unique correlation ID
        correlation_ids = [resp.json()["correlation_id"] for resp in responses]
        
        assert len(correlation_ids) == 5
        assert len(set(correlation_ids)) == 5  # All unique
        
        # Verify all are valid UUIDs
        for correlation_id in correlation_ids:
            try:
                uuid.UUID(correlation_id, version=4)
            except ValueError:
                pytest.fail(f"Generated correlation_id '{correlation_id}' is not a valid UUID4")
    
    def test_middleware_preserves_other_headers(self, client):
        """Test that the middleware preserves other request headers."""
        # GIVEN a request with multiple headers
        expected_correlation_id = str(uuid.uuid4())
        
        # WHEN making a request with multiple headers
        response = client.get(
            "/test",
            headers={
                "X-Correlation-ID": expected_correlation_id,
                "Authorization": "Bearer test-token",
                "X-Custom-Header": "custom-value"
            }
        )
        
        # THEN the correlation ID should be set correctly
        assert response.status_code == 200
        result = response.json()
        assert result["correlation_id"] == expected_correlation_id
    
    def test_handles_empty_correlation_id_header(self, client):
        """Test that middleware generates a new ID if header is empty."""
        # WHEN making a request with empty X-Correlation-ID header
        response = client.get(
            "/test",
            headers={"X-Correlation-ID": ""}
        )
        
        # THEN a new correlation ID should be generated
        assert response.status_code == 200
        result = response.json()
        correlation_id = result["correlation_id"]
        
        # Verify it's a valid UUID4 (not empty)
        assert correlation_id != ""
        assert correlation_id != ":none:"
        try:
            uuid.UUID(correlation_id, version=4)
        except ValueError:
            pytest.fail(f"Generated correlation_id '{correlation_id}' is not a valid UUID4")
    
    def test_async_context_isolation(self, client):
        """Test that correlation IDs are isolated in async context."""
        # GIVEN multiple requests with different correlation IDs
        ids = [str(uuid.uuid4()) for _ in range(3)]
        
        # WHEN making concurrent requests (simulated by sequential in test client)
        responses = [
            client.get("/test", headers={"X-Correlation-ID": cid})
            for cid in ids
        ]
        
        # THEN each response should have its own correlation ID
        for response, expected_id in zip(responses, ids):
            assert response.status_code == 200
            result = response.json()
            assert result["correlation_id"] == expected_id
    
    def test_correlation_id_format_validation(self, client):
        """Test that middleware accepts valid UUID formats."""
        # GIVEN various valid UUID4 formats
        valid_uuid = str(uuid.uuid4())
        
        # WHEN making a request with a valid UUID
        response = client.get(
            "/test",
            headers={"X-Correlation-ID": valid_uuid}
        )
        
        # THEN the UUID should be accepted
        assert response.status_code == 200
        result = response.json()
        assert result["correlation_id"] == valid_uuid
    
    def test_middleware_works_with_post_requests(self, client):
        """Test that middleware works correctly with POST requests."""
        # Create a POST endpoint
        @client.app.post("/test-post")
        async def test_post_endpoint():
            return {"correlation_id": correlation_id_ctx_var.get()}
        
        # GIVEN a correlation ID
        expected_correlation_id = str(uuid.uuid4())
        
        # WHEN making a POST request
        response = client.post(
            "/test-post",
            headers={"X-Correlation-ID": expected_correlation_id},
            json={"data": "test"}
        )
        
        # THEN correlation ID should be set correctly
        assert response.status_code == 200
        result = response.json()
        assert result["correlation_id"] == expected_correlation_id
        assert response.headers["x-correlation-id"] == expected_correlation_id
