"""
Script: 01_clean_db.py
Limpia de forma segura y completa todas las tablas de la base de datos Quantix,
respetando dependencias FK mediante TRUNCATE ... CASCADE y reiniciando datos analiticos.
"""
import os
import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("clean_db")

# Asegurar que backend esta en PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from sqlalchemy import create_engine, text
from app.core.config import settings

def clean_database():
    logger.info("Conectando a PostgreSQL...")
    engine = create_engine(settings.sync_database_uri)

    tables_to_truncate = [
        "incidencias_sync",
        "ventas_offline_recibidas",
        "intentos_pago",
        "auditoria_evento",
        "pagos_venta",
        "detalles_venta",
        "cupones",
        "ventas",
        "arqueo_caja",
        "movimiento_caja",
        "sesion_caja",
        "clientes",
        "detalle_transferencia",
        "transferencia_inventario",
        "detalle_orden_compra",
        "lote_inventario",
        "regla_promocion",
        "producto",
        "categoria",
        "orden_compra",
        "proveedor",
        "configuracion",
        "etl_log",
        "usuario",
        "sucursal",
    ]

    truncate_stmt = f"TRUNCATE TABLE {', '.join(tables_to_truncate)} RESTART IDENTITY CASCADE;"

    with engine.begin() as conn:
        logger.info("Ejecutando vaciado integral de tablas (TRUNCATE CASCADE)...")
        conn.execute(text(truncate_stmt))
        logger.info("OK: Todas las tablas de aplicacion han sido vaciadas exitosamente.")

    duckdb_paths = [
        "/app/data/quantix_analytics.duckdb",
        "data/quantix_analytics.duckdb",
        "quantix_analytics.duckdb"
    ]
    for p in duckdb_paths:
        if os.path.exists(p):
            try:
                os.remove(p)
                logger.info(f"OK: Base de datos analitica DuckDB eliminada para reconstruccion: {p}")
            except Exception as e:
                logger.warning(f"No se pudo eliminar {p}: {e}")

    logger.info("--- Limpieza completada con exito. Base de datos lista para sembrado. ---")

if __name__ == "__main__":
    clean_database()
