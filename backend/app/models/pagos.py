import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class IntentoPago(Base):
    __tablename__ = "intentos_pago"
    __table_args__ = (
        UniqueConstraint("checkout_idempotency_key", "indice", name="uq_intento_pago_checkout_indice"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    checkout_idempotency_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    indice: Mapped[int] = mapped_column(nullable=False, default=0)
    usuario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("usuario.id"), nullable=False)
    sesion_caja_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sesion_caja.id"), nullable=False)
    venta_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("ventas.id"), nullable=True)
    metodo_pago: Mapped[str] = mapped_column(String(30), nullable=False)
    monto: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="INICIADO", index=True)
    escenario_simulado: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    referencia_pasarela: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    codigo_respuesta: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    detalle: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
