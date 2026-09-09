import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import String, Numeric, Integer, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.models.base import Base

class ETLLog(Base):
    __tablename__ = "etl_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tipo_disparo: Mapped[str] = mapped_column(String(50), default="AUTOMATICO_SCHEDULER")
    usuario_email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="EXITOSO")
    duracion_ms: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    
    origen_datos: Mapped[str] = mapped_column(String(255), default="PostgreSQL (quantix_db)")
    destino_archivo: Mapped[str] = mapped_column(String(255), default="DuckDB (quantix_analytics.duckdb)")
    
    filas_bronze_ventas: Mapped[int] = mapped_column(Integer, default=0)
    filas_silver_ventas: Mapped[int] = mapped_column(Integer, default=0)
    filas_gold_ventas: Mapped[int] = mapped_column(Integer, default=0)
    filas_gold_productos: Mapped[int] = mapped_column(Integer, default=0)
    tamano_duckdb_kb: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    
    detalle_trazabilidad: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
