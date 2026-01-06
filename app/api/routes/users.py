from typing import Any, List
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from app.api import deps
from app.models import User
from app.core.db import get_session
from pydantic import BaseModel

router = APIRouter()

from app.schemas.user import UserRead, UserUpdate

@router.get("/", response_model=List[UserRead])
def read_users(
    session: Session = Depends(get_session),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Retrieve users.
    """
    users = session.exec(select(User).offset(skip).limit(limit)).all()
    return users

@router.get("/me", response_model=UserRead)
def read_user_me(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get current user.
    """
    return current_user

@router.patch("/me", response_model=UserRead)
def update_user_me(
    *,
    session: Session = Depends(get_session),
    user_in: UserUpdate,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Update own user.
    """
    user_data = user_in.model_dump(exclude_unset=True)
    current_user.sqlmodel_update(user_data)
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user
