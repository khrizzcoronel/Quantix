import os
import duckdb
import logging
from app.core.config import settings
from datetime import datetime

logger = logging.getLogger(__name__)

class MedallionETL:
    """
    Motor ETL utilizando DuckDB y su extensión postgres_scanner para extraer,
    transformar y cargar datos en la arquitectura Medallion.
    """
    def __init__(self, db_path: str = "quantix_analytics.duckdb"):
        self.db_path = db_path
        # Convertir URI asíncrona a síncrona para la conexión nativa de DuckDB
        self.pg_uri = settings.sync_database_uri

    def run_pipeline(self) -> dict:
        """Ejecuta el ciclo completo de Bronze -> Silver -> Gold y retorna métricas de ejecución."""
        t_inicio = datetime.utcnow()
        logger.info(f"[{t_inicio}] Iniciando Pipeline ETL Medallion...")
        
        resultado = {
            "status": "EXITOSO",
            "timestamp": t_inicio.isoformat(),
            "duracion_ms": 0.0,
            "origen_datos": "PostgreSQL (quantix_db)",
            "destino_archivo": f"DuckDB ({self.db_path})",
            "capas_detalle": {
                "bronze": ["bronze.venta", "bronze.detalle_venta", "bronze.producto"],
                "silver": ["silver.venta_limpia", "silver.producto_activo"],
                "gold": ["gold.fact_ventas", "gold.dim_producto", "gold.dim_tiempo"]
            },
            "filas": {
                "bronze_ventas": 0,
                "silver_ventas": 0,
                "gold_ventas": 0,
                "gold_productos": 0
            },
            "tamano_kb": 0.0,
            "error": None
        }

        try:
            with duckdb.connect(self.db_path) as con:
                self._setup_connections(con)
                self._build_bronze(con)
                self._build_silver(con)
                self._build_gold(con)
                
                try:
                    resultado["filas"]["bronze_ventas"] = con.execute("SELECT COUNT(*) FROM bronze.venta").fetchone()[0]
                    resultado["filas"]["silver_ventas"] = con.execute("SELECT COUNT(*) FROM silver.venta_limpia").fetchone()[0]
                    resultado["filas"]["gold_ventas"] = con.execute("SELECT COUNT(*) FROM gold.fact_ventas").fetchone()[0]
                    resultado["filas"]["gold_productos"] = con.execute("SELECT COUNT(*) FROM gold.dim_producto").fetchone()[0]
                except Exception as ex_counts:
                    logger.warning(f"Error al obtener métricas de conteo: {ex_counts}")

                if os.path.exists(self.db_path):
                    resultado["tamano_kb"] = round(os.path.getsize(self.db_path) / 1024, 2)

                t_fin = datetime.utcnow()
                resultado["duracion_ms"] = round((t_fin - t_inicio).total_seconds() * 1000, 2)
                logger.info(f"Pipeline ETL finalizado con éxito en {resultado['duracion_ms']} ms.")
                return resultado
        except Exception as e:
            t_fin = datetime.utcnow()
            resultado["status"] = "ERROR"
            resultado["error"] = str(e)
            resultado["duracion_ms"] = round((t_fin - t_inicio).total_seconds() * 1000, 2)
            logger.error(f"Fallo crítico en el Pipeline ETL: {str(e)}")
            return resultado

    def _setup_connections(self, con: duckdb.DuckDBPyConnection):
        """Prepara las extensiones y adjunta la base de datos PostgreSQL"""
        logger.info("Cargando extensión postgres_scanner...")
        con.execute("INSTALL postgres;")
        con.execute("LOAD postgres;")
        
        # Adjuntar la base de datos de origen
        try:
            # Ignorar si ya está adjunta
            con.execute(f"ATTACH IF NOT EXISTS '{self.pg_uri}' AS pg (TYPE POSTGRES, READ_ONLY);")
        except Exception as e:
            logger.warning(f"Postgres attach falló (Puede ya estar adjunto): {e}")

    def _build_bronze(self, con: duckdb.DuckDBPyConnection):
        """Capa Bronze: Espejo exacto del OLTP + Metadatos de extracción"""
        logger.info("Construyendo Capa Bronze (Raw)...")
        con.execute("CREATE SCHEMA IF NOT EXISTS bronze;")
        
        # Extraemos Ventas
        con.execute("""
            CREATE OR REPLACE TABLE bronze.venta AS 
            SELECT *, CURRENT_TIMESTAMP AS _extraction_ts 
            FROM pg.ventas;
        """)
        
        # Extraemos Detalles de Venta
        con.execute("""
            CREATE OR REPLACE TABLE bronze.detalle_venta AS 
            SELECT *, CURRENT_TIMESTAMP AS _extraction_ts 
            FROM pg.detalles_venta;
        """)
        
        # Extraemos Productos
        con.execute("""
            CREATE OR REPLACE TABLE bronze.producto AS 
            SELECT *, CURRENT_TIMESTAMP AS _extraction_ts 
            FROM pg.producto;
        """)

    def _build_silver(self, con: duckdb.DuckDBPyConnection):
        """Capa Silver: Limpieza, filtrado de datos corruptos y cancelados"""
        logger.info("Construyendo Capa Silver (Clean)...")
        con.execute("CREATE SCHEMA IF NOT EXISTS silver;")
        
        # Ventas limpias: Solo las completadas
        con.execute("""
            CREATE OR REPLACE TABLE silver.venta_limpia AS 
            SELECT * EXCLUDE(_extraction_ts)
            FROM bronze.venta 
            WHERE estado = 'COMPLETADA';
        """)
        
        # Productos activos
        con.execute("""
            CREATE OR REPLACE TABLE silver.producto_activo AS 
            SELECT * EXCLUDE(_extraction_ts)
            FROM bronze.producto 
            WHERE activo = true;
        """)

    def _build_gold(self, con: duckdb.DuckDBPyConnection):
        """Capa Gold: Modelo Dimensional (Estrella) listo para el BI"""
        logger.info("Construyendo Capa Gold (Dimensional)...")
        con.execute("CREATE SCHEMA IF NOT EXISTS gold;")
        
        # Dimensión Tiempo (Generada a partir de las fechas de venta)
        con.execute("""
            CREATE OR REPLACE TABLE gold.dim_tiempo AS 
            SELECT DISTINCT 
                CAST(fecha_hora AS DATE) AS fecha_id,
                EXTRACT(YEAR FROM fecha_hora) AS anio,
                EXTRACT(MONTH FROM fecha_hora) AS mes,
                EXTRACT(DAY FROM fecha_hora) AS dia,
                EXTRACT(DOW FROM fecha_hora) AS dia_semana
            FROM silver.venta_limpia;
        """)
        
        # Dimensión Producto
        con.execute("""
            CREATE OR REPLACE TABLE gold.dim_producto AS 
            SELECT id AS producto_id, sku, nombre, precio_venta, costo_base 
            FROM silver.producto_activo;
        """)
        
        # Tabla de Hechos: Ventas (Granularidad: Nivel Línea de Detalle)
        con.execute("""
            CREATE OR REPLACE TABLE gold.fact_ventas AS 
            SELECT 
                dv.id AS detalle_id,
                v.id AS venta_id,
                v.cliente_id,
                dv.producto_id,
                CAST(v.fecha_hora AS DATE) AS fecha_id,
                dv.cantidad,
                dv.precio_unitario_venta AS precio_unitario,
                dv.costo_unitario_lote AS costo_unitario,
                dv.subtotal,
                dv.margen_ganancia
            FROM bronze.detalle_venta dv
            INNER JOIN silver.venta_limpia v ON dv.venta_id = v.id;
        """)
