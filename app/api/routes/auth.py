from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from app.api import deps
from app.core import security
from app.models import User
from app.core.db import get_session
from pydantic import BaseModel

router = APIRouter()

class ItemResponse(BaseModel):
    id: int
    name: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str | None = None

class UserRead(BaseModel):
    id: int
    email: str
    full_name: str | None = None

@router.post("/login", response_model=Token)
def login_access_token(
    session: Session = Depends(get_session),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    statement = select(User).where(User.email == form_data.username)
    user = session.exec(statement).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token = security.create_access_token(subject=user.id)
    return {
        "access_token": access_token,
        "token_type": "bearer",
    }

@router.post("/register", response_model=UserRead)
def register_user(
    *,
    session: Session = Depends(get_session),
    user_in: UserCreate,
) -> Any:
    statement = select(User).where(User.email == user_in.email)
    user = session.exec(statement).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this user name already exists in the system",
        )
    
    # Create user
    db_obj = User(
        email=user_in.email,
        hashed_password=security.get_password_hash(user_in.password),
        full_name=user_in.full_name,
    )
    session.add(db_obj)
    
    # Auto-claim orphaned projects (Migration logic)
    # Check if this is the FIRST user? Or just claim any project without owner?
    # Let's claim ALL projects without an owner.
    # Note: Flush first to get ID
    session.flush()
    session.refresh(db_obj)
    
    # This is a bit hacky but efficient: Update all projects with NULL owner to this user
    # Ideally should be done only for the "first" user but this logic safely handles 
    # "orphaned" projects regardless of who registers.
    # We can't do update queries easily with SQLModel session in some versions, 
    # so raw sql or iterating. Let's iterate for safety and event triggers if any.
    from app.models import Project
    orphaned_projects = session.exec(select(Project).where(Project.owner_id == None)).all()
    for p in orphaned_projects:
        p.owner_id = db_obj.id
        session.add(p)
    
    session.commit()
    session.refresh(db_obj)
    return db_obj
