from fastapi import APIRouter, Depends, HTTPException
import duckdb
import pandas as pd
import numpy as np
from scipy import stats
from typing import List

from app.api.deps import RoleChecker, get_current_user
from app.models.usuarios import Usuario
from app.schemas.bi import DashboardEstrategicoResponse, MetricaDiaria, ProyeccionDemanda

router = APIRouter()

# El BI estratégico es exclusivamente para la alta gerencia
estrategico_roles = RoleChecker(["DIRECTOR", "SUPERVISOR"])

DB_PATH = "quantix_analytics.duckdb"

@router.get("/estrategico", response_model=DashboardEstrategicoResponse)
async def dashboard_estrategico(
    current_user: Usuario = Depends(estrategico_roles)
):
    """
    (Módulo 011) Genera el dashboard gerencial conectándose EXCLUSIVAMENTE a 
    la capa Gold de DuckDB, sin tocar ni bloquear el PostgreSQL de los cajeros.
    Aplica estadística inferencial para la proyección de inventario.
    """
    try:
        # Conexión read-only ultrarrápida a DuckDB
        with duckdb.connect(DB_PATH, read_only=True) as con:
            
            # 1. Indicadores Base: Ingresos del mes actual
            df_mes = con.execute("""
                SELECT 
                    SUM(subtotal) as ingresos,
                    SUM(margen_ganancia) / SUM(subtotal) as margen_pct
                FROM gold.fact_ventas f
                JOIN gold.dim_tiempo t ON f.fecha_id = t.fecha_id
                WHERE t.anio = EXTRACT(YEAR FROM CURRENT_DATE) 
                  AND t.mes = EXTRACT(MONTH FROM CURRENT_DATE)
            """).df()
            
            ingresos_mes = float(df_mes['ingresos'][0]) if not pd.isna(df_mes['ingresos'][0]) else 0.0
            margen_mes = float(df_mes['margen_pct'][0]) if not pd.isna(df_mes['margen_pct'][0]) else 0.0

            # 2. Tendencia últimos 7 días
            df_tendencia = con.execute("""
                SELECT 
                    t.fecha_id,
                    SUM(subtotal) as total_ventas,
                    SUM(margen_ganancia) as margen_ganancia
                FROM gold.fact_ventas f
                JOIN gold.dim_tiempo t ON f.fecha_id = t.fecha_id
                GROUP BY t.fecha_id
                ORDER BY t.fecha_id DESC
                LIMIT 7
            """).df()
            
            tendencia = []
            for _, row in df_tendencia.iterrows():
                tendencia.append(MetricaDiaria(
                    fecha=str(row['fecha_id']),
                    total_ventas=float(row['total_ventas']),
                    margen_ganancia=float(row['margen_ganancia'])
                ))
                
            # 3. Predicciones Z/T de Demanda Diaria (Intervalos de Confianza al 95%)
            # Extraemos la serie de tiempo diaria por producto de los últimos 90 días
            df_series = con.execute("""
                SELECT 
                    p.producto_id,
                    p.nombre,
                    t.fecha_id,
                    SUM(f.cantidad) as demanda_diaria
                FROM gold.fact_ventas f
                JOIN gold.dim_producto p ON f.producto_id = p.producto_id
                JOIN gold.dim_tiempo t ON f.fecha_id = t.fecha_id
                GROUP BY p.producto_id, p.nombre, t.fecha_id
            """).df()
            
            predicciones = []
            
            if not df_series.empty:
                # Agrupamos por producto para calcular la estadística de su demanda histórica
                for nombre, df_prod in df_series.groupby(['producto_id', 'nombre']):
                    prod_id, prod_nombre = nombre
                    
                    n = len(df_prod) # Tamaño de la muestra (días que se vendió)
                    if n < 2:
                        continue # Sin varianza no podemos proyectar intervalos
                        
                    demanda_media = df_prod['demanda_diaria'].mean()
                    demanda_std = df_prod['demanda_diaria'].std(ddof=1)
                    
                    # MAGIA INFERENCIAL: Selección automática de la distribución según Teorema del Límite Central
                    if n >= 30:
                        # Muestra grande -> Distribución Z (Normal estándar)
                        score = stats.norm.ppf(0.975) # Dos colas, 95% de confianza
                        dist_usada = "Z (Normal)"
                    else:
                        # Muestra pequeña -> Distribución T de Student (Colas más pesadas)
                        score = stats.t.ppf(0.975, df=n-1)
                        dist_usada = "T (Student)"
                        
                    # Margen de Error = Z * (sigma / sqrt(n))
                    margen_error = score * (demanda_std / np.sqrt(n))
                    
                    predicciones.append(ProyeccionDemanda(
                        producto_id=str(prod_id),
                        nombre_producto=str(prod_nombre),
                        muestras_n=n,
                        distribucion_usada=dist_usada,
                        demanda_media_diaria=round(demanda_media, 2),
                        limite_inferior_95=round(max(0, demanda_media - margen_error), 2),
                        limite_superior_95=round(demanda_media + margen_error, 2)
                    ))

            return DashboardEstrategicoResponse(
                ingresos_mes_actual=round(ingresos_mes, 2),
                margen_promedio_mes=round(margen_mes, 4),
                tendencia_ultimos_7_dias=tendencia,
                predicciones_top_productos=predicciones
            )
            
    except duckdb.CatalogException:
        raise HTTPException(
            status_code=503, 
            detail="La Capa Gold (DuckDB) aún no ha sido construida por el ETL. Espera al primer batch de 5 minutos."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
