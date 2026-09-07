from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
import logging
from typing import Optional

from app.etl.pipeline import MedallionETL

logger = logging.getLogger(__name__)

global_scheduler: Optional[AsyncIOScheduler] = None

def job_ejecutar_etl():
    """Wrapper para instanciar y correr el pipeline Medallion ETL"""
    logger.info("Scheduler: Ejecutando pipeline ETL Medallion...")
    try:
        etl = MedallionETL()
        etl.run_pipeline()
        logger.info("Scheduler: Pipeline ETL Medallion completado exitosamente.")
    except Exception as e:
        logger.error(f"Scheduler: Error durante la ejecución del ETL: {str(e)}")

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
    
    scheduler.start()
    global_scheduler = scheduler
    logger.info("APScheduler iniciado. ETL Micro-batch programado cada 5 minutos.")
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

def trigger_etl_now():
    """
    Dispara una sincronización del ETL inmediatamente fuera de turno.
    """
    logger.info("Scheduler: Sincronización forzada manual solicitada por el Director.")
    job_ejecutar_etl()
