from pydantic import BaseModel
from typing import List, Optional

class MetricaDiaria(BaseModel):
    fecha: str
    total_ventas: float
    margen_ganancia: float

class ProyeccionDemanda(BaseModel):
    producto_id: str
    nombre_producto: str
    muestras_n: int
    distribucion_usada: str
    demanda_media_diaria: float
    limite_inferior_95: float
    limite_superior_95: float

class DashboardEstrategicoResponse(BaseModel):
    ingresos_mes_actual: float
    margen_promedio_mes: float
    tendencia_ultimos_7_dias: List[MetricaDiaria]
    predicciones_top_productos: List[ProyeccionDemanda]
