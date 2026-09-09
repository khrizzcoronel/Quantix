import uuid
import enum
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Enum as SAEnum, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from .base import Base

class RolUsuario(enum.Enum):
    CAJERO = "CAJERO"
    BODEGUERO = "BODEGUERO"
    SUPERVISOR = "SUPERVISOR"
    DIRECTOR = "DIRECTOR"

class EstadoSesionCaja(enum.Enum):
    ABIERTA = "ABIERTA"
    CERRADA = "CERRADA"
    DESCUADRE = "DESCUADRE"

class Usuario(Base):
    __tablename__ = 'usuario'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    rol: Mapped[RolUsuario] = mapped_column(SAEnum(RolUsuario), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    avatar: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    sesiones_caja: Mapped[list["SesionCaja"]] = relationship("SesionCaja", back_populates="usuario", cascade="all, delete-orphan")
    eventos_auditoria: Mapped[list["AuditoriaEvento"]] = relationship("AuditoriaEvento", foreign_keys="[AuditoriaEvento.usuario_id]", back_populates="usuario")
    eventos_autorizados: Mapped[list["AuditoriaEvento"]] = relationship("AuditoriaEvento", foreign_keys="[AuditoriaEvento.usuario_autorizador_id]", back_populates="usuario_autorizador")

    @property
    def nombre_completo(self) -> str:
        return self.nombre

class SesionCaja(Base):
    __tablename__ = 'sesion_caja'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('usuario.id'), nullable=False)
    terminal_id: Mapped[str] = mapped_column(String(255), nullable=False)
    fecha_apertura: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    fecha_cierre: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    fondo_inicial: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    estado: Mapped[EstadoSesionCaja] = mapped_column(SAEnum(EstadoSesionCaja), default=EstadoSesionCaja.ABIERTA, nullable=False)

    usuario: Mapped["Usuario"] = relationship("Usuario", back_populates="sesiones_caja")
    arqueos: Mapped[list["ArqueoCaja"]] = relationship("ArqueoCaja", back_populates="sesion", cascade="all, delete-orphan")

class ArqueoCaja(Base):
    __tablename__ = 'arqueo_caja'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sesion_caja_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('sesion_caja.id'), nullable=False)
    fecha_arqueo: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    
    total_teorico: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    total_fisico_declarado: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    diferencia: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    estado: Mapped[str] = mapped_column(String(50), nullable=False) # OK, SOBRANTE, FALTANTE
    
    sesion: Mapped["SesionCaja"] = relationship("SesionCaja", back_populates="arqueos")


class AuditoriaEvento(Base):
    __tablename__ = 'auditoria_evento'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('usuario.id'), nullable=False)
    tipo_evento: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[str] = mapped_column(String(1000), nullable=False)
    fecha_evento: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    gravedad: Mapped[str] = mapped_column(String(50), nullable=False)
    venta_referencia_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    usuario_autorizador_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey('usuario.id'), nullable=True)
    ip_terminal: Mapped[str | None] = mapped_column(String(45), nullable=True)
    detalle_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    usuario: Mapped["Usuario"] = relationship("Usuario", foreign_keys=[usuario_id], back_populates="eventos_auditoria")
    usuario_autorizador: Mapped["Usuario | None"] = relationship("Usuario", foreign_keys=[usuario_autorizador_id], back_populates="eventos_autorizados")
