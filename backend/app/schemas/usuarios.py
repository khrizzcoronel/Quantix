from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime

class UsuarioCreate(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=255)
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=6, description="Contrasena en texto plano a ser hasheada")
    rol: str = Field("CAJERO", description="CAJERO, BODEGUERO, SUPERVISOR, DIRECTOR")

class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=255)
    email: Optional[str] = Field(None, min_length=5, max_length=255)
    password: Optional[str] = Field(None, min_length=6, description="Nueva contrasena si desea cambiarla")
    rol: Optional[str] = Field(None, description="CAJERO, BODEGUERO, SUPERVISOR, DIRECTOR")
    activo: Optional[bool] = None

class AvatarUpdate(BaseModel):
    avatar: str = Field(..., description="Foto de perfil en formato Base64 o Data URL")

class UsuarioResponse(BaseModel):
    id: UUID
    nombre: str
    email: str
    rol: str
    activo: bool
    avatar: Optional[str] = None
    creado_en: datetime
    model_config = ConfigDict(from_attributes=True)
