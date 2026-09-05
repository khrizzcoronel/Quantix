from datetime import datetime, timedelta
from typing import Any, Union
import jwt
from passlib.context import CryptContext
from app.core.config import settings

# Contexto de encriptación de contraseñas usando bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si la contraseña en texto plano coincide con el hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Genera el hash bcrypt de una contraseña"""
    return pwd_context.hash(password)

def create_access_token(subject: Union[str, Any], rol: str, expires_delta: timedelta = None) -> str:
    """Crea un token JWT firmado con el ID del usuario y su rol"""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {"exp": expire, "sub": str(subject), "rol": rol}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    
    return encoded_jwt
