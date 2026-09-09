from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from decimal import Decimal
from uuid import UUID
from datetime import datetime

class ProductoBuscado(BaseModel):
    id: UUID
    sku: str
    nombre: str
    precio_venta: Decimal
    requiere_pesaje: bool
    stock_total: int
    imagen: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class ItemCarrito(BaseModel):
    producto_id: UUID
    cantidad: int = Field(gt=0, description="Cantidad a comprar. Debe ser mayor a 0.")

class PagoCheckout(BaseModel):
    metodo_pago: str = Field(..., description="EFECTIVO, TARJETA, TRANSFERENCIA, QR, CUPON")
    monto: Decimal = Field(gt=0)
    referencia_pasarela: Optional[str] = None

class CheckoutRequest(BaseModel):
    sesion_caja_id: UUID
    cliente_id: Optional[UUID] = None
    items: Optional[List[ItemCarrito]] = None
    productos_solicitados: Optional[List[dict]] = None
    pagos: Optional[List[PagoCheckout]] = None
    metodo_pago: Optional[str] = None
    codigo_cupon: Optional[str] = None
    idempotency_key: Optional[str] = Field(default=None, min_length=8, max_length=64)
    puntos_canjeados: Optional[int] = Field(default=0, ge=0, description="Puntos de lealtad a canjear como descuento")

class CheckoutResponse(BaseModel):
    venta_id: UUID
    folio_ticket: str
    subtotal: Decimal
    total_descuento: Decimal
    total_impuestos: Decimal
    total_pagar: Decimal
    estado: str
    mensaje: str
    puntos_canjeados: int = 0
    descuento_puntos: Decimal = Decimal("0.00")

class EnviarTicketRequest(BaseModel):
    email: Optional[str] = Field(default=None, description="Correo electrónico de destino")

class DetalleVentaItemResponse(BaseModel):
    id: UUID
    producto_id: UUID
    producto_nombre: str
    producto_sku: str
    lote_id: UUID
    lote_codigo: Optional[str] = None
    cantidad: Decimal
    costo_unitario_lote: Decimal
    precio_unitario_venta: Decimal
    subtotal: Decimal
    margen_ganancia: Decimal

    model_config = ConfigDict(from_attributes=True)

class PagoVentaItemResponse(BaseModel):
    id: UUID
    metodo_pago: str
    monto: Decimal
    referencia_pasarela: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class VentaResumenResponse(BaseModel):
    id: UUID
    sesion_caja_id: UUID
    cliente_id: Optional[UUID] = None
    cliente_cedula: Optional[str] = None
    cliente_nombre: Optional[str] = None
    cliente_telefono: Optional[str] = None
    cliente_email: Optional[str] = None
    folio_ticket: str
    fecha_hora: datetime
    total_bruto: Decimal
    total_descuento: Decimal
    total_impuestos: Decimal
    total_pagar: Decimal
    estado: str
    items_count: int = 0

    model_config = ConfigDict(from_attributes=True)

class VentaDetalleResponse(BaseModel):
    id: UUID
    sesion_caja_id: UUID
    cliente_id: Optional[UUID] = None
    cliente_cedula: Optional[str] = None
    cliente_nombre: Optional[str] = None
    cliente_telefono: Optional[str] = None
    cliente_email: Optional[str] = None
    folio_ticket: str
    fecha_hora: datetime
    total_bruto: Decimal
    total_descuento: Decimal
    total_impuestos: Decimal
    total_pagar: Decimal
    estado: str
    detalles: List[DetalleVentaItemResponse] = []
    pagos: List[PagoVentaItemResponse] = []

    model_config = ConfigDict(from_attributes=True)

class AnularVentaRequest(BaseModel):
    motivo: Optional[str] = "Cancelación y baja lógica autorizada por supervisor"
    supervisor_password: Optional[str] = None
