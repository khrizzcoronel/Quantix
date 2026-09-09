import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy import String, DateTime, ForeignKey, Boolean, Text, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


class VentaOfflineRecibida(Base):
    __tablename__ = "ventas_offline_recibidas"
    __table_args__ = (
        UniqueConstraint("id_local", name="uq_ventas_offline_id_local"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_local: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    terminal_id: Mapped[str] = mapped_column(String(50), nullable=False)
    sesion_caja_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sesion_caja.id"), nullable=False, index=True)
    usuario_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("usuario.id"), nullable=False, index=True)
    fecha_local: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    fecha_recepcion: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    payload_original: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    estado: Mapped[str] = mapped_column(String(30), nullable=False, default="SINCRONIZADA")
    venta_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("ventas.id"), nullable=True, index=True)
    motivo_conflicto: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Relaciones
    sesion_caja: Mapped["SesionCaja"] = relationship("SesionCaja")
    usuario: Mapped["Usuario"] = relationship("Usuario", foreign_keys=[usuario_id])
    venta: Mapped[Optional["Venta"]] = relationship("Venta", foreign_keys=[venta_id])
    incidencias: Mapped[List["IncidenciaSync"]] = relationship("IncidenciaSync", back_populates="venta_offline", cascade="all, delete-orphan")


class IncidenciaSync(Base):
    __tablename__ = "incidencias_sync"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    venta_offline_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ventas_offline_recibidas.id"), nullable=False, index=True)
    tipo: Mapped[str] = mapped_column(String(50), nullable=False)
    detalle: Mapped[str] = mapped_column(Text, nullable=False)
    resuelto: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    resuelto_por: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("usuario.id"), nullable=True)
    resuelto_en: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    nota_resolucion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    # Relaciones
    venta_offline: Mapped["VentaOfflineRecibida"] = relationship("VentaOfflineRecibida", back_populates="incidencias")
    usuario_resolutor: Mapped[Optional["Usuario"]] = relationship("Usuario", foreign_keys=[resuelto_por])
