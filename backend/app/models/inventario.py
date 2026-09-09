import uuid
from datetime import datetime, date
from typing import Optional, List
import enum

from sqlalchemy import String, Integer, Float, Boolean, ForeignKey, DateTime, Date, Enum, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base

class EstadoOrdenCompra(str, enum.Enum):
    PENDIENTE = "PENDIENTE"
    RECIBIDA_PARCIAL = "RECIBIDA_PARCIAL"
    RECIBIDA = "RECIBIDA"
    CANCELADA = "CANCELADA"

class EstadoLote(str, enum.Enum):
    ACTIVO = "ACTIVO"
    AGOTADO = "AGOTADO"
    CADUCADO = "CADUCADO"
    MERMA = "MERMA"

class Proveedor(Base):
    __tablename__ = "proveedor"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    contacto_nombre: Mapped[Optional[str]] = mapped_column(String(255))
    telefono: Mapped[Optional[str]] = mapped_column(String(50))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    lead_time_dias: Mapped[Optional[int]] = mapped_column(Integer)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    ordenes_compra: Mapped[List["OrdenCompra"]] = relationship("OrdenCompra", back_populates="proveedor")

class OrdenCompra(Base):
    __tablename__ = "orden_compra"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proveedor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("proveedor.id"), nullable=False)
    usuario_solicitante_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("usuario.id"), nullable=False)
    fecha_emision: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    fecha_recepcion: Mapped[Optional[datetime]] = mapped_column(DateTime)
    estado: Mapped[EstadoOrdenCompra] = mapped_column(Enum(EstadoOrdenCompra), default=EstadoOrdenCompra.PENDIENTE)
    notas: Mapped[Optional[str]] = mapped_column(String)

    proveedor: Mapped["Proveedor"] = relationship("Proveedor", back_populates="ordenes_compra")
    detalles: Mapped[List["DetalleOrdenCompra"]] = relationship("DetalleOrdenCompra", back_populates="orden_compra")
    lotes: Mapped[List["LoteInventario"]] = relationship("LoteInventario", back_populates="orden_compra")

class DetalleOrdenCompra(Base):
    __tablename__ = "detalle_orden_compra"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    orden_compra_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orden_compra.id"), nullable=False)
    producto_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("producto.id"), nullable=False)
    cantidad_solicitada: Mapped[Numeric] = mapped_column(Numeric(10, 2), nullable=False)
    costo_unitario_pactado: Mapped[Numeric] = mapped_column(Numeric(10, 2), nullable=False)

    orden_compra: Mapped["OrdenCompra"] = relationship("OrdenCompra", back_populates="detalles")
    producto: Mapped["Producto"] = relationship("Producto", back_populates="detalles_orden")

class Categoria(Base):
    __tablename__ = "categoria"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    descripcion: Mapped[Optional[str]] = mapped_column(String)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    productos: Mapped[List["Producto"]] = relationship("Producto", back_populates="categoria")

class Producto(Base):
    __tablename__ = "producto"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    categoria_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("categoria.id"), nullable=False)
    sku: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    codigo_barras: Mapped[Optional[str]] = mapped_column(String(100), unique=True)
    costo_base: Mapped[Numeric] = mapped_column(Numeric(10, 2), nullable=False)
    precio_venta: Mapped[Numeric] = mapped_column(Numeric(10, 2), nullable=False)
    margen_minimo_pct: Mapped[Optional[Numeric]] = mapped_column(Numeric(5, 2))
    requiere_pesaje: Mapped[bool] = mapped_column(Boolean, default=False)
    clasificacion_abc: Mapped[Optional[str]] = mapped_column(String(1))
    imagen: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    categoria: Mapped["Categoria"] = relationship("Categoria", back_populates="productos")
    detalles_orden: Mapped[List["DetalleOrdenCompra"]] = relationship("DetalleOrdenCompra", back_populates="producto")
    lotes: Mapped[List["LoteInventario"]] = relationship("LoteInventario", back_populates="producto")

class LoteInventario(Base):
    __tablename__ = "lote_inventario"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    producto_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("producto.id"), nullable=False)
    orden_compra_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("orden_compra.id"))
    codigo_lote: Mapped[str] = mapped_column(String(100), nullable=False)
    cantidad_inicial: Mapped[Numeric] = mapped_column(Numeric(10, 2), nullable=False)
    cantidad_disponible: Mapped[Numeric] = mapped_column(Numeric(10, 2), nullable=False)
    costo_unitario: Mapped[Numeric] = mapped_column(Numeric(10, 2), nullable=False)
    fecha_ingreso: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    fecha_vencimiento: Mapped[Optional[date]] = mapped_column(Date)
    estado: Mapped[EstadoLote] = mapped_column(Enum(EstadoLote), default=EstadoLote.ACTIVO)

    producto: Mapped["Producto"] = relationship("Producto", back_populates="lotes")
    orden_compra: Mapped[Optional["OrdenCompra"]] = relationship("OrdenCompra", back_populates="lotes")
