from datetime import datetime
import uuid
from typing import Optional
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class Configuracion(Base):
    __tablename__ = "configuracion"

    clave: Mapped[str] = mapped_column(String(100), primary_key=True)
    valor: Mapped[str] = mapped_column(Text, nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tipo_dato: Mapped[str] = mapped_column(String(20), default="STRING")  # STRING, INTEGER, DECIMAL, BOOLEAN
    modificado_por: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("usuario.id"), nullable=True)
    modificado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
