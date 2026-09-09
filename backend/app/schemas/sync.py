from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ItemVentaOffline(BaseModel):
    producto_id: UUID
    cantidad: int = Field(gt=0, description="Cantidad vendida, debe ser mayor a 0")
    precio_unitario: Decimal = Field(ge=0, description="Precio unitario registrado localmente")


class VentaOfflinePayload(BaseModel):
    id_local: str = Field(..., min_length=1, max_length=64, description="UUID o identificador local de la venta")
    terminal_id: str = Field(..., min_length=1, max_length=50)
    sesion_caja_id: UUID
    fecha_local: datetime
    items: List[ItemVentaOffline] = Field(..., min_length=1)
    total_local: Optional[Decimal] = None


class LoteSyncVentasRequest(BaseModel):
    ventas: List[VentaOfflinePayload] = Field(default_factory=list)


class ResultadoVentaSyncItem(BaseModel):
    id_local: str
    estado: str
    venta_id: Optional[UUID] = None
    folio_ticket: Optional[str] = None
    mensaje: str = ""


class SyncLoteResponse(BaseModel):
    procesadas: int
    exitosas: int
    conflictos: int
    detalles: List[ResultadoVentaSyncItem]


class IncidenciaSyncResponse(BaseModel):
    id: UUID
    venta_offline_id: UUID
    id_local: str
    tipo: str
    detalle: str
    resuelto: bool
    creado_en: datetime
    resuelto_por: Optional[UUID] = None
    resuelto_en: Optional[datetime] = None
    nota_resolucion: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ResolverIncidenciaRequest(BaseModel):
    nota_resolucion: str = Field(..., min_length=1, max_length=1000)
