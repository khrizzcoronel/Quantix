from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from decimal import Decimal
from uuid import UUID
from datetime import date, datetime

# =============================================================================
# CATEGORIAS
# =============================================================================
class CategoriaCreate(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100)
    descripcion: Optional[str] = None

class CategoriaUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=100)
    descripcion: Optional[str] = None
    activo: Optional[bool] = None

class CategoriaResponse(BaseModel):
    id: UUID
    nombre: str
    descripcion: Optional[str] = None
    activo: bool
    model_config = ConfigDict(from_attributes=True)

# =============================================================================
# PROVEEDORES
# =============================================================================
class ProveedorCreate(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=255)
    contacto_nombre: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    lead_time_dias: Optional[int] = Field(7, ge=0)

class ProveedorUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=255)
    contacto_nombre: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    lead_time_dias: Optional[int] = Field(None, ge=0)
    activo: Optional[bool] = None

class ProveedorResponse(BaseModel):
    id: UUID
    nombre: str
    contacto_nombre: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    lead_time_dias: Optional[int] = 7
    activo: bool
    model_config = ConfigDict(from_attributes=True)

# =============================================================================
# PRODUCTOS
# =============================================================================
class ProductoCreate(BaseModel):
    categoria_id: UUID
    sku: str = Field(..., min_length=2, max_length=50)
    nombre: str = Field(..., min_length=2, max_length=255)
    codigo_barras: Optional[str] = None
    costo_base: Decimal = Field(..., ge=0)
    precio_venta: Decimal = Field(..., gt=0)
    margen_minimo_pct: Optional[Decimal] = Field(15.0, ge=0)
    requiere_pesaje: bool = False
    clasificacion_abc: Optional[str] = Field("A", max_length=1)
    imagen: Optional[str] = None

class ProductoUpdate(BaseModel):
    categoria_id: Optional[UUID] = None
    sku: Optional[str] = Field(None, min_length=2, max_length=50)
    nombre: Optional[str] = Field(None, min_length=2, max_length=255)
    codigo_barras: Optional[str] = None
    costo_base: Optional[Decimal] = Field(None, ge=0)
    precio_venta: Optional[Decimal] = Field(None, gt=0)
    margen_minimo_pct: Optional[Decimal] = Field(None, ge=0)
    requiere_pesaje: Optional[bool] = None
    clasificacion_abc: Optional[str] = Field(None, max_length=1)
    imagen: Optional[str] = None
    activo: Optional[bool] = None

class ProductoResponse(BaseModel):
    id: UUID
    categoria_id: UUID
    categoria_nombre: Optional[str] = None
    sku: str
    nombre: str
    codigo_barras: Optional[str] = None
    costo_base: Decimal
    precio_venta: Decimal
    margen_minimo_pct: Optional[Decimal] = None
    requiere_pesaje: bool
    clasificacion_abc: Optional[str] = None
    imagen: Optional[str] = None
    activo: bool
    stock_total: Decimal = Decimal("0")
    lotes_activos_count: int = 0
    model_config = ConfigDict(from_attributes=True)

# =============================================================================
# LOTES E INGRESO DE MERCANCIA
# =============================================================================
class ItemRecepcion(BaseModel):
    producto_id: UUID
    cantidad_recibida: Optional[Decimal] = Field(None, gt=0)
    costo_unitario_real: Optional[Decimal] = Field(None, ge=0)
    fecha_vencimiento: Optional[date] = None
    codigo_lote: Optional[str] = None

class RecepcionOrdenRequest(BaseModel):
    items: Optional[List[ItemRecepcion]] = None
    fecha_vencimiento_general: Optional[date] = None
    notas: Optional[str] = None

class IngresoLoteDirectoRequest(BaseModel):
    producto_id: UUID
    codigo_lote: str = Field(..., min_length=1)
    cantidad: Decimal = Field(..., gt=0)
    costo_unitario: Decimal = Field(..., ge=0)
    fecha_vencimiento: Optional[date] = None
    proveedor_id: Optional[UUID] = None
    sucursal_id: Optional[UUID] = None
    notas: Optional[str] = None

class LoteUpdate(BaseModel):
    codigo_lote: Optional[str] = None
    costo_unitario: Optional[Decimal] = Field(None, ge=0)
    fecha_vencimiento: Optional[date] = None

class LoteBajaRequest(BaseModel):
    motivo: str = Field("MERMA", description="MERMA, CADUCADO, DANADO, CUARENTENA")
    cantidad_baja: Optional[Decimal] = Field(None, gt=0, description="Si no se especifica, se da de baja todo el stock remanente del lote")
    notas: Optional[str] = None

class LoteResponse(BaseModel):
    id: UUID
    producto_id: UUID
    producto_nombre: Optional[str] = None
    producto_sku: Optional[str] = None
    codigo_lote: str
    cantidad_inicial: Optional[Decimal] = None
    cantidad_disponible: Decimal
    costo_unitario: Optional[Decimal] = None
    fecha_ingreso: Optional[datetime] = None
    fecha_vencimiento: Optional[date] = None
    estado: str
    sucursal_id: Optional[UUID] = None
    model_config = ConfigDict(from_attributes=True)

# =============================================================================
# ORDENES DE COMPRA Y CADENA DE SUMINISTRO
# =============================================================================
class DetalleOrdenCompraCreate(BaseModel):
    producto_id: UUID
    cantidad_solicitada: Decimal = Field(..., gt=0)
    costo_unitario_pactado: Decimal = Field(..., ge=0)

ItemOrden = DetalleOrdenCompraCreate

class DetalleOrdenCompraResponse(BaseModel):
    id: UUID
    orden_compra_id: Optional[UUID] = None
    producto_id: UUID
    producto_nombre: Optional[str] = None
    producto_sku: Optional[str] = None
    cantidad_solicitada: Decimal
    cantidad_recibida: Decimal = Decimal("0.00")
    cantidad_pendiente: Optional[Decimal] = None
    costo_unitario_pactado: Decimal
    subtotal: Optional[Decimal] = None
    model_config = ConfigDict(from_attributes=True)

DetalleOrdenResponse = DetalleOrdenCompraResponse

class OrdenCompraCreate(BaseModel):
    proveedor_id: UUID
    notas: Optional[str] = None
    items: Optional[List[DetalleOrdenCompraCreate]] = None
    detalles: Optional[List[DetalleOrdenCompraCreate]] = None

    def get_items(self) -> List[DetalleOrdenCompraCreate]:
        result = self.items or self.detalles or []
        if not result:
            raise ValueError("La orden de compra debe contener al menos un producto en 'items' o 'detalles'")
        return result

OrdenCompraRequest = OrdenCompraCreate

class OrdenCompraUpdate(BaseModel):
    notas: Optional[str] = None
    proveedor_id: Optional[UUID] = None

class OrdenCompraResponse(BaseModel):
    id: UUID
    proveedor_id: UUID
    proveedor_nombre: Optional[str] = None
    usuario_solicitante_id: UUID
    usuario_solicitante_nombre: Optional[str] = None
    estado: str
    notas: Optional[str] = None
    fecha_emision: datetime
    fecha_recepcion: Optional[datetime] = None
    detalles: Optional[List[DetalleOrdenCompraResponse]] = None
    lotes: Optional[List[LoteResponse]] = None
    total_estimado: Optional[Decimal] = None
    model_config = ConfigDict(from_attributes=True)

class SugerenciaReordenResponse(BaseModel):
    producto_id: UUID
    sku: str
    nombre: str
    categoria_nombre: Optional[str] = None
    stock_actual: Decimal
    punto_reorden: Decimal
    sugerido_compra: Decimal
    costo_base: Decimal
    precio_venta: Decimal
    clasificacion_abc: Optional[str] = None
    proveedor_sugerido_id: Optional[UUID] = None
    proveedor_sugerido_nombre: Optional[str] = None
    motivo: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
