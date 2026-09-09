from pydantic import BaseModel, Field
from typing import Optional, List
from decimal import Decimal
from uuid import UUID
from datetime import datetime

class SucursalBase(BaseModel):
    codigo: str = Field(..., min_length=2, max_length=50, description="Código único de sucursal (ej. MATRIZ, SUC-NORTE)")
    nombre: str = Field(..., min_length=2, max_length=255, description="Nombre de la sucursal")
    direccion: Optional[str] = Field(None, max_length=500)
    telefono: Optional[str] = Field(None, max_length=50)
    es_matriz: bool = Field(False, description="Indica si es el almacén central / matriz")
    activo: bool = Field(True)

class SucursalCreate(SucursalBase):
    pass

class SucursalUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=255)
    direccion: Optional[str] = Field(None, max_length=500)
    telefono: Optional[str] = Field(None, max_length=50)
    activo: Optional[bool] = None

class SucursalResponse(SucursalBase):
    id: UUID
    creado_en: datetime

    class Config:
        from_attributes = True

class DetalleTransferenciaCreate(BaseModel):
    producto_id: UUID
    cantidad: Decimal = Field(..., gt=0, description="Cantidad a transferir")
    lote_origen_id: Optional[UUID] = Field(None, description="Lote específico o FEFO automático si no se especifica")

class DetalleTransferenciaResponse(BaseModel):
    id: UUID
    producto_id: UUID
    producto_nombre: Optional[str] = None
    producto_sku: Optional[str] = None
    cantidad: Decimal
    lote_origen_id: Optional[UUID] = None
    lote_origen_codigo: Optional[str] = None
    lote_destino_id: Optional[UUID] = None

    class Config:
        from_attributes = True

class TransferenciaCreate(BaseModel):
    sucursal_origen_id: UUID
    sucursal_destino_id: UUID
    notas: Optional[str] = Field(None, max_length=1000)
    items: List[DetalleTransferenciaCreate] = Field(..., min_length=1)

class TransferenciaResponse(BaseModel):
    id: UUID
    folio: str
    sucursal_origen_id: UUID
    sucursal_origen_nombre: Optional[str] = None
    sucursal_destino_id: UUID
    sucursal_destino_nombre: Optional[str] = None
    usuario_solicita_id: UUID
    usuario_solicita_nombre: Optional[str] = None
    usuario_recibe_id: Optional[UUID] = None
    usuario_recibe_nombre: Optional[str] = None
    estado: str
    fecha_solicitud: datetime
    fecha_despacho: Optional[datetime] = None
    fecha_recepcion: Optional[datetime] = None
    notas: Optional[str] = None
    detalles: List[DetalleTransferenciaResponse] = []

    class Config:
        from_attributes = True
