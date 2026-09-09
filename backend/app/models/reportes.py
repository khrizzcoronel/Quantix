import uuid
from datetime import datetime, timezone
from typing import Optional, Any, Dict
from sqlalchemy import String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import JSON

from app.models.base import Base

class PlantillaReporte(Base):
    __tablename__ = "plantillas_reporte"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("usuario.id", ondelete="CASCADE"), nullable=True)
    sucursal_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("sucursal.id", ondelete="SET NULL"), nullable=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    configuracion_json: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    es_publica: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc), 
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc), 
        onupdate=lambda: datetime.now(timezone.utc), 
        nullable=False
    )

    # Relaciones
    usuario = relationship("Usuario", foreign_keys=[usuario_id])
    sucursal = relationship("Sucursal", foreign_keys=[sucursal_id])
