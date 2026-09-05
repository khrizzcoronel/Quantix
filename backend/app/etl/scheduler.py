from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import logging

from app.etl.pipeline import MedallionETL

logger = logging.getLogger(__name__)

def job_ejecutar_etl():
    """Wrapper síncrono/asíncrono para instanciar y correr el ETL"""
    logger.info("Scheduler: Despertando proceso ETL...")
    etl = MedallionETL()
    etl.run_pipeline()

def start_scheduler():
    """
    Inicializa el planificador de tareas (APScheduler).
    Se enganchará al evento 'startup' de FastAPI.
    """
    scheduler = AsyncIOScheduler()
    
    # Trabajo Micro-Batch: Ejecuta cada 5 minutos (RF-ESC-01)
    # En un entorno real se haría un incremental update, para este demo reconstruye rápido
    scheduler.add_job(
        job_ejecutar_etl,
        trigger=CronTrigger(minute='*/5'),
        id='etl_micro_batch',
        name='Actualización ETL cada 5 minutos',
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("APScheduler iniciado. ETL Micro-batch programado cada 5 minutos.")
    return scheduler
