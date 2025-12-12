from fastapi.testclient import TestClient
from app.core.config import settings

def test_read_main(client: TestClient):
    # This route might not exist, but let's check checking the root API docs or something
    # Actually we didn't define a root "/" for app, only the router.
    # But docs should be at /docs
    response = client.get("/docs")
    assert response.status_code == 200

def test_api_v1_prefix(client: TestClient):
    # Check that our stub endpoints are mounted under api/v1
    # GET /api/v1/projects
    response = client.get(f"{settings.API_V1_STR}/projects")
    assert response.status_code == 200
    assert response.json() == [] # Stub returns empty list
