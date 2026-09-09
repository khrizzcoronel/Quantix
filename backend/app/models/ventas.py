import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional
from enum import Enum

from sqlalchemy import String, Integer, Numeric, DateTime, Date, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class TipoCupon(str, Enum):
    CUMPLEANIOS = "CUMPLEANIOS"
    REACTIVACION = "REACTIVACION"
    COMBO = "COMBO"
    MANUAL = "MANUAL"

class DescuentoTipo(str, Enum):
    PORCENTAJE = "PORCENTAJE"
    MONTO_FIJO = "MONTO_FIJO"

class EstadoCupon(str, Enum):
    EMITIDO = "EMITIDO"
    CANJEADO = "CANJEADO"
    EXPIRADO = "EXPIRADO"

class EstadoVenta(str, Enum):
    COMPLETADA = "COMPLETADA"
    CANCELADA_PARCIAL = "CANCELADA_PARCIAL"
    ANULADA = "ANULADA"
    PENDIENTE_SYNC = "PENDIENTE_SYNC"

class MetodoPago(str, Enum):
    EFECTIVO = "EFECTIVO"
    TARJETA = "TARJETA"
    TRANSFERENCIA = "TRANSFERENCIA"
    QR = "QR"
    CUPON = "CUPON"

class Cliente(Base):
    __tablename__ = "clientes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    telefono: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    nombre: Mapped[str] = mapped_column(String(100))
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    fecha_registro: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    puntos_acumulados: Mapped[int] = mapped_column(Integer, default=0)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relaciones
    cupones: Mapped[List["Cupon"]] = relationship(back_populates="cliente")
    ventas: Mapped[List["Venta"]] = relationship(back_populates="cliente")

class Cupon(Base):
    __tablename__ = "cupones"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clientes.id"))
    codigo: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    tipo: Mapped[TipoCupon] = mapped_column(String)
    descuento_tipo: Mapped[DescuentoTipo] = mapped_column(String)
    descuento_valor: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    valido_desde: Mapped[date] = mapped_column(Date)
    valido_hasta: Mapped[date] = mapped_column(Date)
    estado: Mapped[EstadoCupon] = mapped_column(String, default=EstadoCupon.EMITIDO)
    venta_canje_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("ventas.id"), nullable=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relaciones
    cliente: Mapped["Cliente"] = relationship(back_populates="cupones")
    venta_canje: Mapped[Optional["Venta"]] = relationship(back_populates="cupones_canjeados", foreign_keys=[venta_canje_id])

class Venta(Base):
    __tablename__ = "ventas"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    sesion_caja_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sesion_caja.id"))
    cliente_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("clientes.id"), nullable=True)
    folio_ticket: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True, nullable=True)
    fecha_hora: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    total_bruto: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    total_descuento: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    total_impuestos: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    total_pagar: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    estado: Mapped[EstadoVenta] = mapped_column(String, default=EstadoVenta.COMPLETADA)

    # Relaciones
    cliente: Mapped[Optional["Cliente"]] = relationship(back_populates="ventas")
    detalles: Mapped[List["DetalleVenta"]] = relationship(back_populates="venta", cascade="all, delete-orphan")
    pagos: Mapped[List["PagoVenta"]] = relationship(back_populates="venta", cascade="all, delete-orphan")
    cupones_canjeados: Mapped[List["Cupon"]] = relationship(back_populates="venta_canje", foreign_keys="[Cupon.venta_canje_id]")

class DetalleVenta(Base):
    __tablename__ = "detalles_venta"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    venta_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ventas.id"))
    producto_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("producto.id"))
    lote_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lote_inventario.id"))
    cantidad: Mapped[Decimal] = mapped_column(Numeric(10, 3))
    costo_unitario_lote: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    precio_unitario_venta: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    margen_ganancia: Mapped[Decimal] = mapped_column(Numeric(10, 2))

    # Relaciones
    venta: Mapped["Venta"] = relationship(back_populates="detalles")

class PagoVenta(Base):
    __tablename__ = "pagos_venta"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    venta_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ventas.id"))
    metodo_pago: Mapped[MetodoPago] = mapped_column(String)
    monto: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    referencia_pasarela: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relaciones
    venta: Mapped["Venta"] = relationship(back_populates="pagos")
