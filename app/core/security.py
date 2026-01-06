from datetime import datetime, timedelta
from typing import Any, Union
from jose import jwt
from passlib.context import CryptContext
from app.core import config

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"
# In a real app, this should be a secret key from env
SECRET_KEY = "CHANGE_THIS_SECRET_KEY_IN_PRODUCTION" 

def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=60 * 24 * 7) # 1 week default
    
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

import hashlib

def get_password_hash_sha256(password: str) -> str:
    # Use SHA256 to allow passwords > 72 bytes
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Pre-hash the password before verifying
    crypted_password = get_password_hash_sha256(plain_password)
    return pwd_context.verify(crypted_password, hashed_password)

def get_password_hash(password: str) -> str:
    crypted_password = get_password_hash_sha256(password)
    return pwd_context.hash(crypted_password)
