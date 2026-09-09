import os
import duckdb
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

from app.db.oltp import get_db
from app.api.deps import RoleChecker, get_current_user
from app.models.usuarios import Usuario
from app.models.operaciones import ETLLog
from app.etl.scheduler import (
    trigger_etl_now, get_last_etl_result, get_scheduler_info, 
    reschedule_etl, get_etl_history
)
from app.etl.pipeline import MedallionETL
from app.core.config import settings

router = APIRouter()

director_o_supervisor = RoleChecker(["DIRECTOR", "SUPERVISOR"])
director_only = RoleChecker(["DIRECTOR"])

class ReprogramarRequest(BaseModel):
    intervalo_minutos: int

@router.get("/etl/estado")
async def obtener_estado_etl(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(director_o_supervisor)
):
    """
    Retorna el estado operativo en tiempo real del pipeline Medallion ETL, DuckDB y bitácora reciente.
    """
    db_path = "quantix_analytics.duckdb"
    db_exists = os.path.exists(db_path)
    db_size_bytes = os.path.getsize(db_path) if db_exists else 0
    
    tablas_gold: Dict[str, int] = {}
    if db_exists:
        try:
            with duckdb.connect(db_path, read_only=True) as con:
                for t in ["gold.fact_ventas", "gold.dim_producto", "gold.dim_tiempo"]:
                    try:
                        cnt = con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
                        tablas_gold[t] = cnt
                    except Exception:
                        tablas_gold[t] = 0
        except Exception as e:
            tablas_gold["error"] = str(e)

    scheduler_info = get_scheduler_info()
    last_result = get_last_etl_result()

    # Intentar obtener los 5 más recientes de la base de datos
    historial_reciente = []
    try:
        res = await db.execute(select(ETLLog).order_by(ETLLog.creado_en.desc()).limit(5))
        logs_db = res.scalars().all()
        if logs_db:
            historial_reciente = [
                {
                    "id": str(r.id),
                    "tipo_disparo": r.tipo_disparo,
                    "usuario_email": r.usuario_email or "Sistema",
                    "status": r.status,
                    "duracion_ms": float(r.duracion_ms),
                    "origen_datos": r.origen_datos,
                    "destino_archivo": r.destino_archivo,
                    "filas_bronze_ventas": r.filas_bronze_ventas,
                    "filas_silver_ventas": r.filas_silver_ventas,
                    "filas_gold_ventas": r.filas_gold_ventas,
                    "filas_gold_productos": r.filas_gold_productos,
                    "tamano_duckdb_kb": float(r.tamano_duckdb_kb),
                    "capas_detalle": r.detalle_trazabilidad or {},
                    "error": r.error,
                    "creado_en": r.creado_en.isoformat() if hasattr(r.creado_en, 'isoformat') else str(r.creado_en)
                }
                for r in logs_db
            ]
    except Exception:
        pass

    if not historial_reciente:
        historial_reciente = get_etl_history(limit=5)

    return {
        "status": "ONLINE",
        "timestamp": datetime.utcnow().isoformat(),
        "archivo_duckdb": {
            "path": db_path,
            "existe": db_exists,
            "tamano_kb": round(db_size_bytes / 1024, 2),
            "tablas_gold": tablas_gold
        },
        "scheduler": scheduler_info,
        "ultima_ejecucion": last_result,
        "historial_reciente": historial_reciente
    }

@router.get("/etl/historial")
async def obtener_historial_etl(
    limit: int = Query(30, ge=1, le=100, description="Cantidad de registros a obtener"),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(director_o_supervisor)
):
    """
    Retorna la bitácora de trazabilidad (Change Log) con el detalle de qué se guardó y dónde.
    """
    try:
        res = await db.execute(select(ETLLog).order_by(ETLLog.creado_en.desc()).limit(limit))
        logs_db = res.scalars().all()
        if logs_db:
            return {
                "total": len(logs_db),
                "registros": [
                    {
                        "id": str(r.id),
                        "tipo_disparo": r.tipo_disparo,
                        "usuario_email": r.usuario_email or "Sistema",
                        "status": r.status,
                        "duracion_ms": float(r.duracion_ms),
                        "origen_datos": r.origen_datos,
                        "destino_archivo": r.destino_archivo,
                        "filas_bronze_ventas": r.filas_bronze_ventas,
                        "filas_silver_ventas": r.filas_silver_ventas,
                        "filas_gold_ventas": r.filas_gold_ventas,
                        "filas_gold_productos": r.filas_gold_productos,
                        "tamano_duckdb_kb": float(r.tamano_duckdb_kb),
                        "capas_detalle": r.detalle_trazabilidad or {},
                        "error": r.error,
                        "creado_en": r.creado_en.isoformat() if hasattr(r.creado_en, 'isoformat') else str(r.creado_en)
                    }
                    for r in logs_db
                ]
            }
    except Exception:
        pass

    registros = get_etl_history(limit=limit)
    return {
        "total": len(registros),
        "registros": registros
    }

@router.post("/etl/ejecutar")
async def ejecutar_etl_manual(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(director_o_supervisor)
):
    """
    Dispara manualmente el pipeline Medallion ETL y retorna las métricas de ejecución.
    """
    try:
        resultado = trigger_etl_now(usuario_email=current_user.email)
        if resultado.get("status") == "ERROR":
            raise HTTPException(
                status_code=500, 
                detail=f"Fallo al ejecutar el pipeline ETL: {resultado.get('error')}"
            )

        # Persistir inmediatamente en PostgreSQL
        try:
            entry = ETLLog(
                tipo_disparo="MANUAL",
                usuario_email=current_user.email,
                status=resultado.get("status", "EXITOSO"),
                duracion_ms=resultado.get("duracion_ms", 0.0),
                origen_datos=resultado.get("origen_datos", "PostgreSQL (quantix_db)"),
                destino_archivo=resultado.get("destino_archivo", "DuckDB (quantix_analytics.duckdb)"),
                filas_bronze_ventas=resultado.get("filas", {}).get("bronze_ventas", 0),
                filas_silver_ventas=resultado.get("filas", {}).get("silver_ventas", 0),
                filas_gold_ventas=resultado.get("filas", {}).get("gold_ventas", 0),
                filas_gold_productos=resultado.get("filas", {}).get("gold_productos", 0),
                tamano_duckdb_kb=resultado.get("tamano_kb", 0.0),
                detalle_trazabilidad=resultado.get("capas_detalle"),
                error=resultado.get("error")
            )
            db.add(entry)
            await db.commit()
        except Exception:
            pass

        return {
            "mensaje": "Pipeline Medallion ETL completado exitosamente",
            "resultado": resultado
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al disparar ETL: {str(e)}")

@router.post("/etl/reprogramar")
async def reprogramar_frecuencia_etl(
    req: ReprogramarRequest,
    current_user: Usuario = Depends(director_only)
):
    """
    Ajusta dinámicamente en caliente la frecuencia de sincronización de APScheduler.
    """
    if req.intervalo_minutos < 1 or req.intervalo_minutos > 1440:
        raise HTTPException(status_code=400, detail="El intervalo debe estar entre 1 y 1440 minutos.")
    
    try:
        reschedule_etl(req.intervalo_minutos)
        return {
            "mensaje": f"Frecuencia de ETL actualizada a cada {req.intervalo_minutos} minutos.",
            "nuevo_intervalo": req.intervalo_minutos
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al reprogramar scheduler: {str(e)}")
