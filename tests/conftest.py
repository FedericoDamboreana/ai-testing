from typing import Generator
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.main import app
from app.core.db import get_session

@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session

@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()

@pytest.fixture(name="user")
def user_fixture(session: Session):
    from app.models import User
    from app.core.security import get_password_hash
    user = User(
        email="test@example.com", 
        hashed_password=get_password_hash("password"),
        preferred_model="gpt-5"
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

@pytest.fixture(name="auth_client")
def auth_client_fixture(session: Session, user):
    def get_session_override():
        return session
    
    def get_current_user_override():
        return user

    from app.api import deps
    app.dependency_overrides[get_session] = get_session_override
    app.dependency_overrides[deps.get_current_user] = get_current_user_override
    
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()
