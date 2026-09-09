import uuid
import enum
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Enum as SAEnum, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from .base import Base

class EstadoTransferencia(enum.Enum):
    SOLICITADA = "SOLICITADA"
    EN_TRANSITO = "EN_TRANSITO"
    RECIBIDA = "RECIBIDA"
    CANCELADA = "CANCELADA"

class Sucursal(Base):
    __tablename__ = 'sucursal'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    direccion: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    telefono: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    es_matriz: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    transferencias_origen: Mapped[List["TransferenciaInventario"]] = relationship(
        "TransferenciaInventario", foreign_keys="[TransferenciaInventario.sucursal_origen_id]", back_populates="sucursal_origen"
    )
    transferencias_destino: Mapped[List["TransferenciaInventario"]] = relationship(
        "TransferenciaInventario", foreign_keys="[TransferenciaInventario.sucursal_destino_id]", back_populates="sucursal_destino"
    )

class TransferenciaInventario(Base):
    __tablename__ = 'transferencia_inventario'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    folio: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    sucursal_origen_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('sucursal.id'), nullable=False)
    sucursal_destino_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('sucursal.id'), nullable=False)
    usuario_solicita_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('usuario.id'), nullable=False)
    usuario_recibe_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('usuario.id'), nullable=True)
    estado: Mapped[EstadoTransferencia] = mapped_column(SAEnum(EstadoTransferencia), default=EstadoTransferencia.SOLICITADA, nullable=False)
    fecha_solicitud: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    fecha_despacho: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    fecha_recepcion: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    sucursal_origen: Mapped["Sucursal"] = relationship("Sucursal", foreign_keys=[sucursal_origen_id], back_populates="transferencias_origen")
    sucursal_destino: Mapped["Sucursal"] = relationship("Sucursal", foreign_keys=[sucursal_destino_id], back_populates="transferencias_destino")
    usuario_solicita: Mapped["Usuario"] = relationship("Usuario", foreign_keys=[usuario_solicita_id])
    usuario_recibe: Mapped[Optional["Usuario"]] = relationship("Usuario", foreign_keys=[usuario_recibe_id])
    detalles: Mapped[List["DetalleTransferencia"]] = relationship("DetalleTransferencia", back_populates="transferencia", cascade="all, delete-orphan")

class DetalleTransferencia(Base):
    __tablename__ = 'detalle_transferencia'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transferencia_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('transferencia_inventario.id', ondelete='CASCADE'), nullable=False)
    producto_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('producto.id'), nullable=False)
    lote_origen_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('lote_inventario.id'), nullable=True)
    cantidad: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    lote_destino_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('lote_inventario.id'), nullable=True)

    transferencia: Mapped["TransferenciaInventario"] = relationship("TransferenciaInventario", back_populates="detalles")
    producto: Mapped["Producto"] = relationship("Producto")
    lote_origen: Mapped[Optional["LoteInventario"]] = relationship("LoteInventario", foreign_keys=[lote_origen_id])
    lote_destino: Mapped[Optional["LoteInventario"]] = relationship("LoteInventario", foreign_keys=[lote_destino_id])
