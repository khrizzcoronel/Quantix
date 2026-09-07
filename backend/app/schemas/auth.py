from pydantic import BaseModel
from typing import Optional
from uuid import UUID

class UserAuthResponse(BaseModel):
    id: UUID
    email: str
    nombre: str
    rol: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: Optional[UserAuthResponse] = None
    
class TokenPayload(BaseModel):
    sub: Optional[str] = None
    rol: Optional[str] = None

class SupervisorOverrideRequest(BaseModel):
    email: str
    password: str
