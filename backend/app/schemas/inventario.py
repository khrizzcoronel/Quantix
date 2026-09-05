from pydantic import BaseModel, Field
from typing import List, Optional
from decimal import Decimal
from uuid import UUID
from datetime import date, datetime

class ItemOrden(BaseModel):
    producto_id: UUID
    cantidad_solicitada: Decimal = Field(..., gt=0)
    costo_unitario_pactado: Decimal = Field(..., gt=0)

class OrdenCompraRequest(BaseModel):
    proveedor_id: UUID
    notas: Optional[str] = None
    items: List[ItemOrden] = Field(..., min_length=1)

class OrdenCompraResponse(BaseModel):
    id: UUID
    proveedor_id: UUID
    usuario_solicitante_id: UUID
    estado: str
    fecha_emision: datetime
    
    class Config:
        from_attributes = True

class ItemRecepcion(BaseModel):
    producto_id: UUID
    cantidad_recibida: Decimal = Field(..., gt=0)
    costo_unitario_real: Decimal = Field(..., gt=0)
    fecha_vencimiento: date
    codigo_lote: str = Field(..., min_length=1)

class RecepcionOrdenRequest(BaseModel):
    items: List[ItemRecepcion] = Field(..., min_length=1)
    
class LoteResponse(BaseModel):
    id: UUID
    producto_id: UUID
    codigo_lote: str
    cantidad_disponible: Decimal
    fecha_vencimiento: date
    estado: str
    
    class Config:
        from_attributes = True
