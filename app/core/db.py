from sqlmodel import SQLModel, create_engine, Session
from app.core.config import settings

import os

# Create DB directory if it doesn't exist (for Cloud Run mounted volumes)
if settings.SQLITE_PATH:
    db_dir = os.path.dirname(settings.SQLITE_PATH)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

connect_args = {"check_same_thread": False}
engine = create_engine(settings.DATABASE_URL, echo=True, connect_args=connect_args)

def init_db():
    # Import models here to ensure they are registered with SQLModel
    from app.models import project, test_case, metric, evaluation
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
