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
    items: List[ItemCarrito] = Field(..., min_length=1)
    pagos: List[PagoCheckout] = Field(..., min_length=1)

class CheckoutResponse(BaseModel):
    venta_id: UUID
    folio_ticket: str
    total_pagar: Decimal
    estado: str
    mensaje: str
