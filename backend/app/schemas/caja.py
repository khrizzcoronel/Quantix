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

class SesionDetalleResponse(BaseModel):
    id: UUID
    usuario_id: UUID
    usuario_nombre: Optional[str] = None
    terminal_id: str
    fecha_apertura: datetime
    fecha_cierre: Optional[datetime] = None
    fondo_inicial: Decimal
    estado: str
    total_teorico: Optional[Decimal] = None
    total_fisico: Optional[Decimal] = None
    diferencia: Optional[Decimal] = None
    estado_cuadre: Optional[str] = None

    class Config:
        from_attributes = True

class AuditoriaEventoResponse(BaseModel):
    id: UUID
    usuario_id: UUID
    usuario_nombre: Optional[str] = None
    tipo_evento: str
    descripcion: str
    fecha_evento: datetime
    gravedad: str
    venta_referencia_id: Optional[UUID] = None
    usuario_autorizador_id: Optional[UUID] = None
    ip_terminal: Optional[str] = None
    detalle_json: Optional[dict] = None

    class Config:
        from_attributes = True

class CorteZResponse(BaseModel):
    sesion_id: UUID
    folio_corte: str
    cajero_id: UUID
    cajero_nombre: str
    cajero_email: Optional[str] = None
    terminal_id: str
    fecha_apertura: datetime
    fecha_cierre: Optional[datetime] = None
    fondo_inicial: Decimal
    total_ventas: Decimal
    total_bruto: Decimal
    total_descuento: Decimal
    total_impuestos: Decimal
    ventas_efectivo: Decimal
    ventas_tarjeta: Decimal
    ventas_transferencia: Decimal
    ventas_otros: Decimal
    total_tickets_emitidos: int
    primer_folio: Optional[str] = None
    ultimo_folio: Optional[str] = None
    tickets_anulados: int = 0
    total_fisico_declarado: Optional[Decimal] = None
    total_teorico: Optional[Decimal] = None
    diferencia: Optional[Decimal] = None
    estado_cuadre: Optional[str] = None
    estado: str
    fecha_emision: datetime

    class Config:
        from_attributes = True

class EstadisticaCajeroItem(BaseModel):
    usuario_id: UUID
    usuario_nombre: str
    usuario_email: str
    total_sesiones: int
    total_ventas_acumuladas: Decimal
    total_tickets: int
    promedio_tickets_por_turno: float
    total_descuadres: int
    promedio_descuadre: Decimal
    precision_gaveta_pct: float
    ultima_sesion_fecha: Optional[datetime] = None
    ultimo_estado: Optional[str] = None

class EstadisticasHistoricasCajasResponse(BaseModel):
    metricas_globales: dict
    cajeros: list[EstadisticaCajeroItem]

class MiActividadTicketItem(BaseModel):
    id: UUID
    folio_ticket: str
    fecha_hora: datetime
    total_pagar: Decimal
    estado: str
    cliente_nombre: Optional[str] = None

class MiActividadResponse(BaseModel):
    sesion_activa: Optional[SesionDetalleResponse] = None
    resumen_hoy: dict
    tickets_hoy: list[MiActividadTicketItem]
    eventos_auditoria_hoy: list[AuditoriaEventoResponse]

