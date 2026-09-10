from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime

class ClienteCreate(BaseModel):
    cedula: Optional[str] = Field(None, max_length=30, description="Cédula de identidad / RFC / DNI")
    telefono: str = Field(..., description="Teléfono celular (Usado como ID rápido en caja)")
    nombre: str = Field(..., max_length=255)
    email: Optional[EmailStr] = None
    sucursal_id: Optional[UUID] = None

class ClienteUpdate(BaseModel):
    cedula: Optional[str] = Field(None, max_length=30)
    telefono: Optional[str] = Field(None, max_length=20)
    nombre: Optional[str] = Field(None, max_length=255)
    email: Optional[EmailStr] = None
    puntos_acumulados: Optional[int] = Field(None, ge=0)
    activo: Optional[bool] = None
    sucursal_id: Optional[UUID] = None

class ClienteResponse(BaseModel):
    id: UUID
    sucursal_id: Optional[UUID] = None
    sucursal_nombre: Optional[str] = None
    cedula: Optional[str] = None
    telefono: str
    nombre: str
    email: Optional[str] = None
    puntos_acumulados: int = 0
    activo: bool = True
    fecha_registro: datetime
    model_config = ConfigDict(from_attributes=True)

class ValidarCuponRequest(BaseModel):
    codigo: str = Field(..., description="Código alfanumérico del cupón")
    sucursal_id: Optional[UUID] = Field(None, description="Sucursal donde se intenta validar")

class ValidarCuponResponse(BaseModel):
    valido: bool
    mensaje: str
    tipo_descuento: Optional[str] = None # PORCENTAJE o MONTO_FIJO
    valor_descuento: Optional[Decimal] = None
    cupon_id: Optional[UUID] = None

class CuponCreate(BaseModel):
    cliente_id: UUID
    sucursal_id: Optional[UUID] = None
    codigo: str = Field(..., max_length=50)
    tipo: str = Field(default="MANUAL", description="CUMPLEANIOS, REACTIVACION, COMBO, MANUAL")
    descuento_tipo: str = Field(default="PORCENTAJE", description="PORCENTAJE, MONTO_FIJO")
    descuento_valor: Decimal = Field(gt=0)
    valido_desde: Optional[datetime] = None
    valido_hasta: Optional[datetime] = None

class CuponResponse(BaseModel):
    id: UUID
    cliente_id: UUID
    cliente_nombre: Optional[str] = None
    sucursal_id: Optional[UUID] = None
    sucursal_nombre: Optional[str] = None
    codigo: str
    tipo: str
    descuento_tipo: str
    descuento_valor: Decimal
    valido_desde: Optional[datetime] = None
    valido_hasta: Optional[datetime] = None
    estado: str
    creado_en: datetime
    model_config = ConfigDict(from_attributes=True)

class HistorialVentaClienteResponse(BaseModel):
    id: UUID
    folio_ticket: str
    fecha_hora: datetime
    total_bruto: Decimal
    total_descuento: Decimal
    total_pagar: Decimal
    estado: str
    model_config = ConfigDict(from_attributes=True)

