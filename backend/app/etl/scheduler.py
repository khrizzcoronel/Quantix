from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
import logging
from typing import Optional

from app.etl.pipeline import MedallionETL

logger = logging.getLogger(__name__)

from datetime import datetime

global_scheduler: Optional[AsyncIOScheduler] = None
last_etl_result: dict = {
    "status": "PENDIENTE",
    "timestamp": None,
    "duracion_ms": 0.0,
    "filas": {
        "bronze_ventas": 0,
        "silver_ventas": 0,
        "gold_ventas": 0,
        "gold_productos": 0
    },
    "error": None
}
etl_history: list = []

def guardar_registro_etl(res: dict, tipo_disparo: str = "AUTOMATICO_SCHEDULER", usuario_email: Optional[str] = None) -> dict:
    global etl_history
    import uuid
    log_entry = {
        "id": str(uuid.uuid4()),
        "tipo_disparo": tipo_disparo,
        "usuario_email": usuario_email or ("admin@quantix.local" if tipo_disparo == "MANUAL" else "Sistema (APScheduler)"),
        "status": res.get("status", "EXITOSO"),
        "duracion_ms": res.get("duracion_ms", 0.0),
        "origen_datos": res.get("origen_datos", "PostgreSQL (quantix_db)"),
        "destino_archivo": res.get("destino_archivo", "DuckDB (quantix_analytics.duckdb)"),
        "filas_bronze_ventas": res.get("filas", {}).get("bronze_ventas", 0),
        "filas_silver_ventas": res.get("filas", {}).get("silver_ventas", 0),
        "filas_gold_ventas": res.get("filas", {}).get("gold_ventas", 0),
        "filas_gold_productos": res.get("filas", {}).get("gold_productos", 0),
        "tamano_duckdb_kb": res.get("tamano_kb", 0.0),
        "capas_detalle": res.get("capas_detalle", {
            "bronze": ["bronze.venta", "bronze.detalle_venta", "bronze.producto"],
            "silver": ["silver.venta_limpia", "silver.producto_activo"],
            "gold": ["gold.fact_ventas", "gold.dim_producto", "gold.dim_tiempo"]
        }),
        "error": res.get("error"),
        "creado_en": res.get("timestamp") or datetime.utcnow().isoformat()
    }
    
    etl_history.insert(0, log_entry)
    if len(etl_history) > 50:
        etl_history.pop()

    try:
        from app.core.config import settings
        import psycopg2
        import json
        conn = psycopg2.connect(settings.sync_database_uri)
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO etl_log (
                    id, tipo_disparo, usuario_email, status, duracion_ms,
                    origen_datos, destino_archivo, filas_bronze_ventas,
                    filas_silver_ventas, filas_gold_ventas, filas_gold_productos,
                    tamano_duckdb_kb, detalle_trazabilidad, error, creado_en
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
            """, (
                log_entry["id"],
                log_entry["tipo_disparo"],
                log_entry["usuario_email"],
                log_entry["status"],
                log_entry["duracion_ms"],
                log_entry["origen_datos"],
                log_entry["destino_archivo"],
                log_entry["filas_bronze_ventas"],
                log_entry["filas_silver_ventas"],
                log_entry["filas_gold_ventas"],
                log_entry["filas_gold_productos"],
                log_entry["tamano_duckdb_kb"],
                json.dumps(log_entry["capas_detalle"]),
                log_entry["error"],
                log_entry["creado_en"]
            ))
            conn.commit()
        conn.close()
    except Exception as ex_db:
        logger.warning(f"No se pudo persistir etl_log en PostgreSQL: {ex_db}")

    return log_entry

def get_etl_history(limit: int = 20) -> list:
    global etl_history
    try:
        from app.core.config import settings
        import psycopg2
        import json
        conn = psycopg2.connect(settings.sync_database_uri)
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, tipo_disparo, usuario_email, status, duracion_ms,
                       origen_datos, destino_archivo, filas_bronze_ventas,
                       filas_silver_ventas, filas_gold_ventas, filas_gold_productos,
                       tamano_duckdb_kb, detalle_trazabilidad, error, creado_en
                FROM etl_log
                ORDER BY creado_en DESC
                LIMIT %s
            """, (limit,))
            rows = cur.fetchall()
            if rows:
                db_entries = []
                for r in rows:
                    db_entries.append({
                        "id": str(r[0]),
                        "tipo_disparo": r[1],
                        "usuario_email": r[2] or "Sistema",
                        "status": r[3],
                        "duracion_ms": float(r[4]),
                        "origen_datos": r[5],
                        "destino_archivo": r[6],
                        "filas_bronze_ventas": r[7],
                        "filas_silver_ventas": r[8],
                        "filas_gold_ventas": r[9],
                        "filas_gold_productos": r[10],
                        "tamano_duckdb_kb": float(r[11]),
                        "capas_detalle": r[12] if isinstance(r[12], dict) else (json.loads(r[12]) if r[12] else {}),
                        "error": r[13],
                        "creado_en": r[14].isoformat() if hasattr(r[14], 'isoformat') else str(r[14])
                    })
                conn.close()
                return db_entries
        conn.close()
    except Exception as ex:
        logger.warning(f"Lectura de etl_log en PostgreSQL falló, usando in-memory history: {ex}")
    
    return etl_history[:limit]

def job_ejecutar_etl(tipo_disparo: str = "AUTOMATICO_SCHEDULER", usuario_email: Optional[str] = None) -> dict:
    """Wrapper para instanciar y correr el pipeline Medallion ETL"""
    global last_etl_result
    logger.info(f"Scheduler: Ejecutando pipeline ETL Medallion ({tipo_disparo})...")
    try:
        etl = MedallionETL()
        res = etl.run_pipeline()
        last_etl_result = res
        guardar_registro_etl(res, tipo_disparo=tipo_disparo, usuario_email=usuario_email)
        logger.info("Scheduler: Pipeline ETL Medallion completado exitosamente.")

        # Emitir notificación WS de sincronización exitosa
        try:
            from app.api.ws import notif_manager
            total_gold = res.get("filas", {}).get("gold_ventas", 0)
            duracion = res.get("duracion_ms", 0.0)
            notif_manager.emit_alerta_sync(
                tipo="ETL_SYNC",
                titulo="Sincronización ETL Completada",
                mensaje=f"Pipeline Medallion sincronizó {total_gold} ventas analíticas en {duracion:.1f}ms ({tipo_disparo})",
                severidad="SUCCESS",
                payload=res
            )
            notif_manager.emit_evento_sync({
                "tipo": "ETL_SYNC",
                "titulo": "Sincronización Analítica ETL",
                "mensaje": f"Capa Gold actualizada con {total_gold} ventas ({duracion:.1f}ms)",
                "severidad": "SUCCESS",
                "payload": res
            })
        except Exception as ex_ws:
            logger.debug(f"No se pudo emitir notificación WS para ETL: {ex_ws}")

        return res
    except Exception as e:
        logger.error(f"Scheduler: Error durante la ejecución del ETL: {str(e)}")
        last_etl_result = {
            "status": "ERROR",
            "timestamp": datetime.utcnow().isoformat(),
            "duracion_ms": 0.0,
            "filas": {},
            "error": str(e)
        }
        guardar_registro_etl(last_etl_result, tipo_disparo=tipo_disparo, usuario_email=usuario_email)

        # Emitir alerta WS de error crítico en ETL
        try:
            from app.api.ws import notif_manager
            notif_manager.emit_alerta_sync(
                tipo="ETL_ERROR",
                titulo="Error en Sincronización ETL",
                mensaje=f"Fallo al sincronizar pipeline ETL ({tipo_disparo}): {str(e)}",
                severidad="CRITICO",
                payload=last_etl_result
            )
        except Exception as ex_ws:
            logger.debug(f"No se pudo emitir alerta WS de error ETL: {ex_ws}")

        return last_etl_result

def get_last_etl_result() -> dict:
    return last_etl_result

last_alertas_result: dict = {
    "status": "PENDIENTE",
    "timestamp": None,
    "sobrestock_detectados": 0,
    "cupones_reactivacion_emitidos": 0,
    "descuadres_repetidos_detectados": 0,
    "error": None
}

async def job_alertas_predictivas() -> dict:
    """
    (WS5 - Background Predictive Alerts)
    Job periódico programado en APScheduler (cada 15 minutos):
    1. Detecta productos con stock > 0 y 0 ventas en los últimos 60 días -> emite alerta de sobrestock.
    2. Detecta clientes con > 45 días sin compra -> emite cupón automático de reactivación ('REACTIVACION', 15% desc).
    3. Detecta terminales o cajeros con descuadres repetidos (>2) en la última semana.
    """
    global last_alertas_result
    from app.db.oltp import AsyncSessionLocal
    from sqlalchemy import select, func, or_
    from datetime import datetime, timezone, timedelta, date
    from decimal import Decimal
    import uuid

    from app.models.inventario import Producto, LoteInventario, EstadoLote
    from app.models.ventas import Cliente, Cupon, Venta, DetalleVenta, TipoCupon, DescuentoTipo, EstadoCupon, EstadoVenta
    from app.models.usuarios import Usuario, RolUsuario, SesionCaja, ArqueoCaja, EstadoSesionCaja, AuditoriaEvento

    logger.info("Scheduler: Ejecutando job de Alertas Predictivas en Background...")
    ahora_naive = datetime.utcnow()
    ahora_aware = datetime.now(timezone.utc)
    res_summary = {
        "status": "EXITOSO",
        "timestamp": ahora_aware.isoformat(),
        "sobrestock_detectados": 0,
        "cupones_reactivacion_emitidos": 0,
        "descuadres_repetidos_detectados": 0,
        "error": None
    }

    try:
        async with AsyncSessionLocal() as session:
            # Obtener usuario sistema o director para asociar las alertas
            res_u = await session.execute(
                select(Usuario).where(Usuario.rol == RolUsuario.DIRECTOR).limit(1)
            )
            director_user = res_u.scalars().first()
            if not director_user:
                res_any_u = await session.execute(select(Usuario).limit(1))
                director_user = res_any_u.scalars().first()
            
            sistema_usuario_id = director_user.id if director_user else None

            # -------------------------------------------------------------
            # REGLA 1: SOBRESTOCK (Stock > 0 y 0 ventas en últimos 60 días)
            # -------------------------------------------------------------
            hace_60_dias_naive = ahora_naive - timedelta(days=60)
            
            # Productos con stock disponible activo
            q_stock = (
                select(Producto, func.sum(LoteInventario.cantidad_disponible).label("stock_total"))
                .join(LoteInventario, LoteInventario.producto_id == Producto.id)
                .where(
                    Producto.activo == True,
                    LoteInventario.estado == EstadoLote.ACTIVO,
                    LoteInventario.cantidad_disponible > 0
                )
                .group_by(Producto.id)
            )
            res_stock = await session.execute(q_stock)
            prods_con_stock = res_stock.all()

            # Productos que SI tuvieron ventas en últimos 60 días (fecha_hora es naive)
            q_vendidos = (
                select(DetalleVenta.producto_id)
                .join(Venta, DetalleVenta.venta_id == Venta.id)
                .where(
                    Venta.estado == EstadoVenta.COMPLETADA,
                    Venta.fecha_hora >= hace_60_dias_naive
                )
                .distinct()
            )
            res_vendidos = await session.execute(q_vendidos)
            vendidos_ids = set(res_vendidos.scalars().all())

            # Evitar alertar productos ya alertados en los últimos 7 días
            hace_7_dias_aware = ahora_aware - timedelta(days=7)
            q_alertas_prev = (
                select(AuditoriaEvento)
                .where(
                    AuditoriaEvento.tipo_evento == 'ALERTA_SOBRESTOCK',
                    AuditoriaEvento.fecha_evento >= hace_7_dias_aware
                )
            )
            res_alertas_prev = await session.execute(q_alertas_prev)
            eventos_sobrestock_prev = res_alertas_prev.scalars().all()
            prods_alertados_recientemente = set()
            for ev in eventos_sobrestock_prev:
                if ev.detalle_json and isinstance(ev.detalle_json, dict):
                    pid = ev.detalle_json.get("producto_id")
                    if pid:
                        prods_alertados_recientemente.add(pid)

            for prod, stock in prods_con_stock:
                if prod.id not in vendidos_ids and str(prod.id) not in prods_alertados_recientemente:
                    if sistema_usuario_id:
                        alerta_ev = AuditoriaEvento(
                            usuario_id=sistema_usuario_id,
                            tipo_evento="ALERTA_SOBRESTOCK",
                            descripcion=f"Alerta Predictiva: Producto '{prod.nombre}' (SKU: {prod.sku}) mantiene stock de {float(stock):.1f} u. sin ventas en 60 días.",
                            gravedad="MEDIA",
                            ip_terminal="SISTEMA_ETL",
                            detalle_json={
                                "producto_id": str(prod.id),
                                "sku": prod.sku,
                                "nombre": prod.nombre,
                                "stock_disponible": float(stock),
                                "dias_inmovilizado": 60
                            }
                        )
                        session.add(alerta_ev)
                        res_summary["sobrestock_detectados"] += 1

            # -------------------------------------------------------------
            # REGLA 2: CLIENTES INACTIVOS (>45 días) -> CUPÓN REACTIVACIÓN
            # -------------------------------------------------------------
            hace_45_dias_aware = ahora_aware - timedelta(days=45)
            
            # Última compra por cliente
            q_ultimas_compras = (
                select(Venta.cliente_id, func.max(Venta.fecha_hora).label("ultima_fecha"))
                .where(Venta.cliente_id.is_not(None), Venta.estado == EstadoVenta.COMPLETADA)
                .group_by(Venta.cliente_id)
            )
            res_ultimas = await session.execute(q_ultimas_compras)
            mapa_ultimas_compras = {row[0]: row[1] for row in res_ultimas.all()}

            q_clientes = select(Cliente).where(Cliente.activo == True)
            res_cli = await session.execute(q_clientes)
            todos_clientes = res_cli.scalars().all()

            hoy_fecha = date.today()
            for cli in todos_clientes:
                es_inactivo = False
                if cli.id in mapa_ultimas_compras:
                    fecha_compra = mapa_ultimas_compras[cli.id]
                    if fecha_compra.tzinfo is None:
                        fecha_compra = fecha_compra.replace(tzinfo=timezone.utc)
                    if fecha_compra < hace_45_dias_aware:
                        es_inactivo = True
                else:
                    fecha_reg = cli.fecha_registro
                    if fecha_reg is not None:
                        if fecha_reg.tzinfo is None:
                            fecha_reg = fecha_reg.replace(tzinfo=timezone.utc)
                        if fecha_reg < hace_45_dias_aware:
                            es_inactivo = True
                    else:
                        es_inactivo = True

                if es_inactivo:
                    # Verificar si ya cuenta con cupón de REACTIVACION activo
                    q_cup_vig = (
                        select(Cupon)
                        .where(
                            Cupon.cliente_id == cli.id,
                            Cupon.tipo == TipoCupon.REACTIVACION,
                            Cupon.estado == EstadoCupon.EMITIDO,
                            Cupon.valido_hasta >= hoy_fecha
                        )
                    )
                    res_cup_vig = await session.execute(q_cup_vig)
                    if not res_cup_vig.scalars().first():
                        tel_suffix = cli.telefono[-4:] if cli.telefono and len(cli.telefono) >= 4 else "AUTO"
                        codigo_reactivacion = f"REACTIVACION-{tel_suffix}-{uuid.uuid4().hex[:4].upper()}"
                        
                        nuevo_cupon = Cupon(
                            cliente_id=cli.id,
                            codigo=codigo_reactivacion,
                            tipo=TipoCupon.REACTIVACION,
                            descuento_tipo=DescuentoTipo.PORCENTAJE,
                            descuento_valor=Decimal("15.00"),
                            valido_desde=hoy_fecha,
                            valido_hasta=hoy_fecha + timedelta(days=30),
                            estado=EstadoCupon.EMITIDO
                        )
                        session.add(nuevo_cupon)

                        if sistema_usuario_id:
                            evento_crm = AuditoriaEvento(
                                usuario_id=sistema_usuario_id,
                                tipo_evento="CUPON_REACTIVACION_EMITIDO",
                                descripcion=f"Alerta CRM: Cupón automático de reactivación (15% desc) '{codigo_reactivacion}' para cliente {cli.nombre}.",
                                gravedad="INFO",
                                ip_terminal="SISTEMA_CRM",
                                detalle_json={
                                    "cliente_id": str(cli.id),
                                    "cliente_nombre": cli.nombre,
                                    "codigo": codigo_reactivacion,
                                    "descuento_pct": 15
                                }
                            )
                            session.add(evento_crm)
                        res_summary["cupones_reactivacion_emitidos"] += 1

            # -------------------------------------------------------------
            # REGLA 3: DESCUADRES REPETIDOS EN LA SEMANA (>2)
            # -------------------------------------------------------------
            q_ses_desc = (
                select(SesionCaja, ArqueoCaja, Usuario)
                .join(Usuario, SesionCaja.usuario_id == Usuario.id)
                .join(ArqueoCaja, ArqueoCaja.sesion_caja_id == SesionCaja.id)
                .where(
                    SesionCaja.fecha_apertura >= hace_7_dias_aware,
                    or_(
                        ArqueoCaja.estado != 'OK',
                        func.abs(ArqueoCaja.diferencia) > Decimal("5.00"),
                        SesionCaja.estado == EstadoSesionCaja.DESCUADRE
                    )
                )
            )
            res_ses_desc = await session.execute(q_ses_desc)
            filas_descuadre = res_ses_desc.all()

            conteo_por_operador = {}
            for s_item, a_item, u_item in filas_descuadre:
                clave = (u_item.id, u_item.nombre, s_item.terminal_id)
                conteo_por_operador[clave] = conteo_por_operador.get(clave, 0) + 1

            hace_24_horas_aware = ahora_aware - timedelta(hours=24)
            q_alertas_desc_prev = (
                select(AuditoriaEvento)
                .where(
                    AuditoriaEvento.tipo_evento == 'ALERTA_DESCUADRES_REPETIDOS',
                    AuditoriaEvento.fecha_evento >= hace_24_horas_aware
                )
            )
            res_desc_prev = await session.execute(q_alertas_desc_prev)
            eventos_desc_prev = res_desc_prev.scalars().all()
            operadores_alertados_hoy = set()
            for ev in eventos_desc_prev:
                if ev.detalle_json and isinstance(ev.detalle_json, dict):
                    op_uid = ev.detalle_json.get("usuario_id")
                    term = ev.detalle_json.get("terminal_id")
                    if op_uid:
                        operadores_alertados_hoy.add((op_uid, term))

            for (op_id, op_nombre, term_id), cant_desc in conteo_por_operador.items():
                if cant_desc > 2 and (str(op_id), term_id) not in operadores_alertados_hoy:
                    alerta_forense = AuditoriaEvento(
                        usuario_id=op_id,
                        tipo_evento="ALERTA_DESCUADRES_REPETIDOS",
                        descripcion=f"Alerta de Seguridad Forense: El cajero {op_nombre} en terminal {term_id} registra {cant_desc} descuadres en la semana (>2 permitidos).",
                        gravedad="CRITICA",
                        ip_terminal=term_id,
                        detalle_json={
                            "usuario_id": str(op_id),
                            "cajero_nombre": op_nombre,
                            "terminal_id": term_id,
                            "num_descuadres": cant_desc,
                            "periodo_dias": 7
                        }
                    )
                    session.add(alerta_forense)
                    res_summary["descuadres_repetidos_detectados"] += 1

            await session.commit()

        # Emitir broadcast por WebSockets si se detectaron alertas
        total_nuevas = (
            res_summary["sobrestock_detectados"] +
            res_summary["cupones_reactivacion_emitidos"] +
            res_summary["descuadres_repetidos_detectados"]
        )
        if total_nuevas > 0:
            try:
                from app.api.ws import notif_manager
                notif_manager.emit_alerta_sync(
                    tipo="ALERTA_PREDICTIVA",
                    titulo="Alertas Predictivas en Background Detectadas",
                    mensaje=f"Se detectaron: {res_summary['sobrestock_detectados']} sobrestock, {res_summary['cupones_reactivacion_emitidos']} cupones reactivación, {res_summary['descuadres_repetidos_detectados']} descuadres recurrentes.",
                    severidad="CRITICO" if res_summary['descuadres_repetidos_detectados'] > 0 else "INFO",
                    payload=res_summary
                )
            except Exception as ex_ws:
                logger.debug(f"Broadcast omitido: {ex_ws}")

        last_alertas_result = res_summary
        logger.info(f"Scheduler: Job Alertas Predictivas completado: {res_summary}")
        return res_summary

    except Exception as e:
        logger.error(f"Scheduler: Error en job_alertas_predictivas: {str(e)}")
        res_summary["status"] = "ERROR"
        res_summary["error"] = str(e)
        last_alertas_result = res_summary
        return res_summary

def get_last_alertas_result() -> dict:
    return last_alertas_result

def get_scheduler_info() -> dict:
    global global_scheduler
    running = global_scheduler is not None and global_scheduler.running
    intervalo = 5
    if global_scheduler:
        job = global_scheduler.get_job('etl_micro_batch')
        if job and hasattr(job.trigger, 'interval'):
            intervalo = int(job.trigger.interval.total_seconds() / 60)
    return {
        "running": running,
        "intervalo_minutos": intervalo,
        "job_id": "etl_micro_batch",
        "last_alertas": last_alertas_result
    }

def start_scheduler():
    """
    Inicializa el planificador de tareas (APScheduler).
    Se conecta al ciclo de vida de FastAPI.
    """
    global global_scheduler
    if global_scheduler and global_scheduler.running:
        return global_scheduler

    scheduler = AsyncIOScheduler()
    
    # Trabajo Micro-Batch por defecto cada 5 minutos
    scheduler.add_job(
        job_ejecutar_etl,
        trigger=IntervalTrigger(minutes=5),
        id='etl_micro_batch',
        name='Actualización ETL Micro-Batch',
        replace_existing=True
    )

    # Trabajo de Alertas Predictivas cada 15 minutos (WS5)
    scheduler.add_job(
        job_alertas_predictivas,
        trigger=IntervalTrigger(minutes=15),
        id='alertas_predictivas',
        name='Alertas Predictivas y Reactivación en Background',
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("APScheduler iniciado. ETL Micro-batch (5m) y Alertas Predictivas (15m) activados.")
    global_scheduler = scheduler
    return scheduler

def reschedule_etl(intervalo_minutos: int):
    """
    Reprograma dinámicamente la frecuencia de ejecución del ETL en caliente.
    """
    global global_scheduler
    if not global_scheduler:
        logger.warning("Scheduler no inicializado, creando uno nuevo...")
        start_scheduler()

    intervalo_minutos = max(1, intervalo_minutos) # Mínimo 1 minuto
    
    global_scheduler.reschedule_job(
        job_id='etl_micro_batch',
        trigger=IntervalTrigger(minutes=intervalo_minutos)
    )
    logger.info(f"Scheduler: Frecuencia de ETL reprogramada en caliente a cada {intervalo_minutos} minutos.")

def trigger_etl_now(usuario_email: Optional[str] = None) -> dict:
    """
    Dispara una sincronización del ETL inmediatamente fuera de turno y retorna métricas.
    """
    logger.info(f"Scheduler: Sincronización forzada manual solicitada por {usuario_email or 'usuario'}.")
    return job_ejecutar_etl(tipo_disparo="MANUAL", usuario_email=usuario_email)
