from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import date, datetime

# --- 1. KPIs Avanzados ---
class KPISucursalItem(BaseModel):
    sucursal_id: Optional[UUID] = None
    codigo: Optional[str] = None
    nombre: str
    total_ventas: float
    total_margen: float
    margen_pct: float
    total_tickets: int
    ticket_promedio: float
    total_unidades: float

class KPIFechaItem(BaseModel):
    fecha: str
    total_ventas: float
    total_margen: float
    margen_pct: float
    total_tickets: int
    ticket_promedio: float
    total_unidades: float

class KPIsAvanzadosResponse(BaseModel):
    total_ventas: float
    total_margen: float
    margen_pct: float
    total_tickets: int
    ticket_promedio: float
    total_unidades: float
    total_clientes_unicos: int
    total_descuentos: float
    desglose_sucursales: List[KPISucursalItem] = []
    desglose_fechas: List[KPIFechaItem] = []

# --- 2. Tendencias ---
class TendenciaItem(BaseModel):
    periodo: str
    total_ventas: float
    total_margen: float
    margen_pct: float
    numero_tickets: int
    ticket_promedio: float
    unidades_vendidas: float

class TendenciasResponse(BaseModel):
    agrupacion: str
    total_periodos: int
    series: List[TendenciaItem] = []

# --- 3. ABC Productos ---
class ABCProductoItem(BaseModel):
    producto_id: UUID
    sku: str
    nombre: str
    categoria: Optional[str] = None
    ingresos: float
    margen: float
    margen_pct: float
    unidades: float
    porcentaje_ingresos: float
    porcentaje_acumulado: float
    clasificacion_abc: str

class ABCResumenItem(BaseModel):
    total_productos: int
    total_ingresos: float
    porcentaje_ingresos: float
    porcentaje_productos: float

class ABCProductosResponse(BaseModel):
    resumen_a: ABCResumenItem
    resumen_b: ABCResumenItem
    resumen_c: ABCResumenItem
    total_ingresos_general: float
    total_productos_general: int
    productos: List[ABCProductoItem] = []

# --- 4. RFM Clientes ---
class RFMClienteItem(BaseModel):
    cliente_id: UUID
    cedula: Optional[str] = None
    cliente_nombre: str
    cliente_email: Optional[str] = None
    cliente_telefono: Optional[str] = None
    puntos_acumulados: int
    ultima_compra: Optional[str] = None
    recencia_dias: int
    frecuencia: int
    valor_monetario: float
    r_score: int
    f_score: int
    m_score: int
    rfm_score_total: int
    segmento_rfm: str

class RFMSegmentoResumen(BaseModel):
    segmento: str
    cantidad_clientes: int
    porcentaje_clientes: float
    total_monetario: float
    ticket_promedio: float

class RFMClientesResponse(BaseModel):
    total_clientes: int
    distribucion_segmentos: List[RFMSegmentoResumen] = []
    clientes: List[RFMClienteItem] = []

# --- 5. Estacionalidad ---
class EstacionalidadCelda(BaseModel):
    dia_semana: int
    dia_nombre: str
    hora: int
    volumen_ventas: float
    num_transacciones: int
    ticket_promedio: float

class EstacionalidadResponse(BaseModel):
    hora_pico: int
    dia_pico: str
    total_volumen: float
    total_transacciones: int
    matriz_7x24: List[EstacionalidadCelda] = []

# --- 6. Proyecciones ---
class ProyeccionDemandaItem(BaseModel):
    producto_id: UUID
    sku: str
    nombre_producto: str
    muestras_dias: int
    distribucion_usada: str
    demanda_media_diaria: float
    desviacion_estandar: float
    margen_error_95: float
    limite_inferior_diario_95: float
    limite_superior_diario_95: float
    dias_proyectados: int
    proyeccion_total: float
    proyeccion_min_95: float
    proyeccion_max_95: float

class ProyeccionesDemandaResponse(BaseModel):
    dias_proyectados: int
    proyecciones: List[ProyeccionDemandaItem] = []

# --- 7. Catálogo de Columnas Disponibles ---
class ColumnaDisponible(BaseModel):
    id: str
    label: str
    tipo: str  # "string", "currency", "number", "date", "datetime", "percentage"
    categoria: str
    agrupable: bool = False
    filtrable: bool = True
    sortable: bool = True

class CatalogoColumnasResponse(BaseModel):
    columnas: List[ColumnaDisponible] = []

# --- 8. Generar Reporte Dinámico ---
class GenerarReporteRequest(BaseModel):
    fecha_desde: Optional[date] = None
    fecha_hasta: Optional[date] = None
    sucursal_id: Optional[UUID] = None
    categoria_id: Optional[UUID] = None
    metodo_pago: Optional[str] = None
    cajero_id: Optional[UUID] = None
    agrupacion: Optional[str] = "ninguna"  # ninguna, dia, producto, categoria, cajero, sucursal, metodo_pago
    columnas: Optional[List[str]] = None
    orden_campo: Optional[str] = None
    orden_dir: Optional[str] = "desc"
    page: int = Field(1, ge=1)
    page_size: int = Field(50, ge=1, le=500)

class GenerarReporteResponse(BaseModel):
    columnas: List[str]
    filas: List[Dict[str, Any]]
    totales: Dict[str, Any]
    total_registros: int
    page: int
    page_size: int
    total_paginas: int

# --- 9. Plantillas de Reporte ---
class PlantillaReporteBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    descripcion: Optional[str] = Field(None, max_length=255)
    configuracion_json: Dict[str, Any]
    es_publica: bool = True
    sucursal_id: Optional[UUID] = None

class PlantillaReporteCreate(PlantillaReporteBase):
    pass

class PlantillaReporteResponse(PlantillaReporteBase):
    id: UUID
    usuario_id: Optional[UUID] = None
    sucursal_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
