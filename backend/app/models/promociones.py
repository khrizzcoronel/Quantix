import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from enum import Enum

from sqlalchemy import String, Numeric, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base

class TipoReglaPromocion(str, Enum):
    COMBO = "COMBO"
    VOLUMEN = "VOLUMEN"
    MONTO_MINIMO = "MONTO_MINIMO"

class DescuentoReglaTipo(str, Enum):
    PORCENTAJE = "PORCENTAJE"
    MONTO_FIJO = "MONTO_FIJO"

class ReglaPromocion(Base):
    __tablename__ = "regla_promocion"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    tipo_regla: Mapped[TipoReglaPromocion] = mapped_column(String, default=TipoReglaPromocion.COMBO)
    
    producto_disparador_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("producto.id"), nullable=True)
    producto_beneficio_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("producto.id"), nullable=True)
    categoria_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("categoria.id"), nullable=True)
    
    descuento_tipo: Mapped[DescuentoReglaTipo] = mapped_column(String, default=DescuentoReglaTipo.PORCENTAJE)
    descuento_valor: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("10.00"))
    cantidad_minima: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("1.00"))
    monto_minimo: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relaciones
    producto_disparador = relationship("Producto", foreign_keys=[producto_disparador_id])
    producto_beneficio = relationship("Producto", foreign_keys=[producto_beneficio_id])
    categoria = relationship("Categoria", foreign_keys=[categoria_id])
