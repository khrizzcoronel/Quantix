from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class IntentoPagoResponse(BaseModel):
    id: UUID
    checkout_idempotency_key: str
    indice: int
    usuario_id: UUID
    sesion_caja_id: UUID
    venta_id: Optional[UUID] = None
    metodo_pago: str
    monto: Decimal
    estado: str
    referencia_pasarela: Optional[str] = None
    codigo_respuesta: Optional[str] = None
    detalle: Optional[str] = None
    creado_en: datetime
    actualizado_en: datetime

    model_config = ConfigDict(from_attributes=True)


class ConciliarIntentoRequest(BaseModel):
    resultado: Literal["APROBADO", "RECHAZADO"]
    detalle: Optional[str] = None
