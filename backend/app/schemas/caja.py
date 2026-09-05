from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal
from uuid import UUID
from datetime import datetime

class AperturaCajaRequest(BaseModel):
    fondo_inicial: Decimal = Field(..., ge=0, description="Efectivo base en caja al iniciar turno")
    terminal_id: str = Field(..., description="ID de la terminal física donde se opera")

class ConteoFisico(BaseModel):
    efectivo: Decimal = Field(0, ge=0)
    tarjeta: Decimal = Field(0, ge=0)
    transferencia: Decimal = Field(0, ge=0)
    otros: Decimal = Field(0, ge=0)

    @property
    def total(self) -> Decimal:
        return self.efectivo + self.tarjeta + self.transferencia + self.otros

class ArqueoCiegoRequest(BaseModel):
    conteo_declarado: ConteoFisico

class SesionCajaResponse(BaseModel):
    id: UUID
    usuario_id: UUID
    terminal_id: str
    fecha_apertura: datetime
    fondo_inicial: Decimal
    estado: str

    class Config:
        from_attributes = True

class ArqueoResponse(BaseModel):
    sesion_caja_id: UUID
    total_teorico: Decimal
    total_fisico_declarado: Decimal
    diferencia: Decimal
    estado: str
    requiere_auditoria: bool
    mensaje: str
