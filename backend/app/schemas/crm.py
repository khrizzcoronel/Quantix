from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime

class ClienteCreate(BaseModel):
    telefono: str = Field(..., description="Teléfono celular (Usado como ID rápido en caja)")
    nombre: str = Field(..., max_length=255)
    email: Optional[EmailStr] = None

class ClienteResponse(BaseModel):
    id: UUID
    telefono: str
    nombre: str
    email: Optional[str]
    puntos_acumulados: int
    fecha_registro: datetime
    
    class Config:
        from_attributes = True

class ValidarCuponRequest(BaseModel):
    codigo: str = Field(..., description="Código alfanumérico del cupón")
    
class ValidarCuponResponse(BaseModel):
    valido: bool
    mensaje: str
    tipo_descuento: Optional[str] = None # PORCENTAJE o MONTO_FIJO
    valor_descuento: Optional[Decimal] = None
    cupon_id: Optional[UUID] = None
