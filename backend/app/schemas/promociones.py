from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from app.models.promociones import TipoReglaPromocion, DescuentoReglaTipo

class ItemCarritoEvaluar(BaseModel):
    producto_id: UUID
    cantidad: Decimal = Field(default=Decimal("1.00"), gt=0)
    precio_unitario: Optional[Decimal] = None

class ReglaPromocionBase(BaseModel):
    nombre: str = Field(..., max_length=150)
    tipo_regla: TipoReglaPromocion = TipoReglaPromocion.COMBO
    producto_disparador_id: Optional[UUID] = None
    producto_beneficio_id: Optional[UUID] = None
    categoria_id: Optional[UUID] = None
    descuento_tipo: DescuentoReglaTipo = DescuentoReglaTipo.PORCENTAJE
    descuento_valor: Decimal = Field(default=Decimal("10.00"), ge=0)
    cantidad_minima: Decimal = Field(default=Decimal("1.00"), ge=0)
    monto_minimo: Decimal = Field(default=Decimal("0.00"), ge=0)
    activo: bool = True

class ReglaPromocionCreate(ReglaPromocionBase):
    pass

class ReglaPromocionUpdate(BaseModel):
    nombre: Optional[str] = Field(None, max_length=150)
    tipo_regla: Optional[TipoReglaPromocion] = None
    producto_disparador_id: Optional[UUID] = None
    producto_beneficio_id: Optional[UUID] = None
    categoria_id: Optional[UUID] = None
    descuento_tipo: Optional[DescuentoReglaTipo] = None
    descuento_valor: Optional[Decimal] = Field(None, ge=0)
    cantidad_minima: Optional[Decimal] = Field(None, ge=0)
    monto_minimo: Optional[Decimal] = Field(None, ge=0)
    activo: Optional[bool] = None

class ReglaPromocionResponse(ReglaPromocionBase):
    id: UUID
    creado_en: datetime
    producto_disparador_nombre: Optional[str] = None
    producto_beneficio_nombre: Optional[str] = None
    categoria_nombre: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class EvaluarCarritoRequest(BaseModel):
    items: List[ItemCarritoEvaluar]
    cliente_id: Optional[UUID] = None

class PromocionAplicada(BaseModel):
    regla_id: UUID
    nombre: str
    tipo_regla: str
    descuento_monto: Decimal
    mensaje: str
    producto_beneficiado_id: Optional[UUID] = None

    model_config = ConfigDict(from_attributes=True)

class EvaluarCarritoResponse(BaseModel):
    subtotal_bruto: Decimal
    total_descuento: Decimal
    total_con_descuento: Decimal
    promociones_aplicadas: List[PromocionAplicada]
    margen_respetado: bool = True
    mensaje: Optional[str] = None
