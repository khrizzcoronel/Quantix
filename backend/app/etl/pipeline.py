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
    def __init__(self, db_path: str = None):
        if db_path is None:
            if os.path.exists("/app/data"):
                db_path = "/app/data/quantix_analytics.duckdb"
            elif os.path.exists("data"):
                db_path = "data/quantix_analytics.duckdb"
            else:
                db_path = "quantix_analytics.duckdb"
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
                "bronze": [
                    "bronze.venta", "bronze.detalle_venta", "bronze.producto",
                    "bronze.cliente", "bronze.usuario", "bronze.sucursal",
                    "bronze.sesion_caja", "bronze.pagos_venta", "bronze.categoria_producto"
                ],
                "silver": [
                    "silver.venta_limpia", "silver.producto_activo",
                    "silver.cliente_limpio", "silver.usuario_activo", "silver.sucursal_activa"
                ],
                "gold": [
                    "gold.fact_ventas", "gold.dim_producto", "gold.dim_tiempo",
                    "gold.dim_cliente", "gold.dim_cajero", "gold.dim_sucursal"
                ]
            },
            "filas": {
                "bronze_ventas": 0,
                "silver_ventas": 0,
                "gold_ventas": 0,
                "gold_productos": 0,
                "gold_clientes": 0,
                "gold_cajeros": 0,
                "gold_sucursales": 0
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
                    resultado["filas"]["gold_clientes"] = con.execute("SELECT COUNT(*) FROM gold.dim_cliente").fetchone()[0]
                    resultado["filas"]["gold_cajeros"] = con.execute("SELECT COUNT(*) FROM gold.dim_cajero").fetchone()[0]
                    resultado["filas"]["gold_sucursales"] = con.execute("SELECT COUNT(*) FROM gold.dim_sucursal").fetchone()[0]
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

        # Extraemos Clientes
        con.execute("""
            CREATE OR REPLACE TABLE bronze.cliente AS 
            SELECT *, CURRENT_TIMESTAMP AS _extraction_ts 
            FROM pg.clientes;
        """)
        con.execute("CREATE OR REPLACE VIEW bronze.clientes AS SELECT * FROM bronze.cliente;")

        # Extraemos Usuarios
        try:
            con.execute("""
                CREATE OR REPLACE TABLE bronze.usuario AS 
                SELECT *, CURRENT_TIMESTAMP AS _extraction_ts 
                FROM pg.usuarios;
            """)
        except Exception:
            con.execute("""
                CREATE OR REPLACE TABLE bronze.usuario AS 
                SELECT *, CURRENT_TIMESTAMP AS _extraction_ts 
                FROM pg.usuario;
            """)
        con.execute("CREATE OR REPLACE VIEW bronze.usuarios AS SELECT * FROM bronze.usuario;")

        # Extraemos Sucursales
        try:
            con.execute("""
                CREATE OR REPLACE TABLE bronze.sucursal AS 
                SELECT *, CURRENT_TIMESTAMP AS _extraction_ts 
                FROM pg.sucursales;
            """)
        except Exception:
            con.execute("""
                CREATE OR REPLACE TABLE bronze.sucursal AS 
                SELECT *, CURRENT_TIMESTAMP AS _extraction_ts 
                FROM pg.sucursal;
            """)
        con.execute("CREATE OR REPLACE VIEW bronze.sucursales AS SELECT * FROM bronze.sucursal;")

        # Extraemos Sesion Caja
        con.execute("""
            CREATE OR REPLACE TABLE bronze.sesion_caja AS 
            SELECT *, CURRENT_TIMESTAMP AS _extraction_ts 
            FROM pg.sesion_caja;
        """)

        # Extraemos Pagos Venta
        con.execute("""
            CREATE OR REPLACE TABLE bronze.pagos_venta AS 
            SELECT *, CURRENT_TIMESTAMP AS _extraction_ts 
            FROM pg.pagos_venta;
        """)

        # Extraemos Categoria Producto
        try:
            con.execute("""
                CREATE OR REPLACE TABLE bronze.categoria_producto AS 
                SELECT *, CURRENT_TIMESTAMP AS _extraction_ts 
                FROM pg.categoria_producto;
            """)
        except Exception:
            con.execute("""
                CREATE OR REPLACE TABLE bronze.categoria_producto AS 
                SELECT *, CURRENT_TIMESTAMP AS _extraction_ts 
                FROM pg.categoria;
            """)
        con.execute("CREATE OR REPLACE VIEW bronze.categoria AS SELECT * FROM bronze.categoria_producto;")

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

        # Clientes limpios: Activos
        con.execute("""
            CREATE OR REPLACE TABLE silver.cliente_limpio AS 
            SELECT * EXCLUDE(_extraction_ts)
            FROM bronze.cliente 
            WHERE activo = true;
        """)

        # Usuarios activos
        con.execute("""
            CREATE OR REPLACE TABLE silver.usuario_activo AS 
            SELECT * EXCLUDE(_extraction_ts)
            FROM bronze.usuario 
            WHERE activo = true;
        """)

        # Sucursales activas
        con.execute("""
            CREATE OR REPLACE TABLE silver.sucursal_activa AS 
            SELECT * EXCLUDE(_extraction_ts)
            FROM bronze.sucursal 
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
            SELECT 
                p.id AS producto_id, 
                p.sku, 
                p.nombre, 
                p.precio_venta, 
                p.costo_base,
                p.categoria_id,
                COALESCE(c.nombre, 'Sin Categoría') AS categoria_nombre
            FROM silver.producto_activo p
            LEFT JOIN bronze.categoria_producto c ON p.categoria_id = c.id;
        """)

        # Dimensión Cliente
        con.execute("""
            CREATE OR REPLACE TABLE gold.dim_cliente AS 
            SELECT 
                id AS cliente_id,
                cedula,
                nombre,
                email,
                telefono,
                puntos_acumulados
            FROM silver.cliente_limpio;
        """)

        # Dimensión Cajero / Usuario
        con.execute("""
            CREATE OR REPLACE TABLE gold.dim_cajero AS 
            SELECT 
                id AS usuario_id,
                nombre,
                email,
                rol
            FROM silver.usuario_activo;
        """)

        # Dimensión Sucursal
        con.execute("""
            CREATE OR REPLACE TABLE gold.dim_sucursal AS 
            SELECT 
                id AS sucursal_id,
                codigo,
                nombre,
                CAST('' AS VARCHAR) AS ciudad
            FROM silver.sucursal_activa;
        """)

        # Dimensión Pagos
        con.execute("""
            CREATE OR REPLACE TABLE gold.fact_pagos AS 
            SELECT 
                id AS pago_id,
                venta_id,
                metodo_pago,
                monto,
                referencia_pasarela
            FROM bronze.pagos_venta;
        """)
        
        # Tabla de Hechos: Ventas (Granularidad: Nivel Línea de Detalle)
        # Enriquecida con sucursal_id, sesion_caja_id, cajero_id, total_bruto, total_descuento, total_impuestos, total_pagar, estado
        con.execute("""
            CREATE OR REPLACE TABLE gold.fact_ventas AS 
            SELECT 
                dv.id AS detalle_id,
                v.id AS venta_id,
                v.cliente_id,
                v.sucursal_id,
                v.sesion_caja_id,
                s.usuario_id AS cajero_id,
                dv.producto_id,
                CAST(v.fecha_hora AS DATE) AS fecha_id,
                v.fecha_hora,
                dv.cantidad,
                dv.precio_unitario_venta AS precio_unitario,
                dv.costo_unitario_lote AS costo_unitario,
                dv.subtotal,
                dv.margen_ganancia,
                v.total_bruto,
                v.total_descuento,
                v.total_impuestos,
                v.total_pagar,
                v.estado
            FROM bronze.detalle_venta dv
            INNER JOIN silver.venta_limpia v ON dv.venta_id = v.id
            LEFT JOIN bronze.sesion_caja s ON v.sesion_caja_id = s.id;
        """)
