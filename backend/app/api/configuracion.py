from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from typing import Dict, Any

from app.db.oltp import get_db
from app.api.deps import RoleChecker
from app.models.configuracion import Configuracion
from app.schemas.configuracion import (
    ConfiguracionBulkUpdate, ConfiguracionesAgrupadas,
    SMTPTestRequest, ETLTriggerResponse
)
from app.etl.scheduler import reschedule_etl, trigger_etl_now
from app.services.email import EmailSender
from app.models.usuarios import Usuario

router = APIRouter()

# Solo el DIRECTOR tiene permiso para acceder y modificar las configuraciones
director_required = RoleChecker(["DIRECTOR"])

CONFIGS_DEFAULT = {
    # ETL
    "etl_intervalo_minutos": ("5", "Frecuencia en minutos del micro-batch de DuckDB", "INTEGER"),
    "etl_hora_cierre_diario": ("02:00", "Hora del batch nocturno profundo (HH:MM)", "STRING"),
    # SMTP
    "smtp_host": ("smtp.gmail.com", "Servidor SMTP para envío de correos", "STRING"),
    "smtp_port": ("587", "Puerto del servidor SMTP", "INTEGER"),
    "smtp_user": ("alertas@quantix.local", "Correo emisor institucional", "STRING"),
    "smtp_password": ("", "Token o contraseña de aplicación", "STRING"),
    # Políticas
    "caja_tolerancia_descuadre": ("5.00", "Tolerancia máxima permitida en dinero antes de emitir alerta crítica", "DECIMAL"),
    "fefo_alerta_dias_1": ("15", "Primer umbral de alerta sanitaria en días antes de caducar", "INTEGER"),
    "fefo_alerta_dias_2": ("30", "Segundo umbral de alerta sanitaria para activar promociones", "INTEGER"),
}

async def ensure_defaults(db: AsyncSession):
    """Asegura que los valores predeterminados existan en la tabla configuracion"""
    for clave, (valor, desc, tipo) in CONFIGS_DEFAULT.items():
        res = await db.execute(select(Configuracion).where(Configuracion.clave == clave))
        if not res.scalar_one_or_none():
            db.add(Configuracion(
                clave=clave,
                valor=valor,
                descripcion=desc,
                tipo_dato=tipo
            ))
    await db.commit()

@router.get("", response_model=ConfiguracionesAgrupadas)
async def obtener_configuraciones(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(director_required)
):
    """
    Retorna todos los parámetros globales del sistema agrupados por área temática.
    Exclusivo para el rol DIRECTOR.
    """
    await ensure_defaults(db)
    result = await db.execute(select(Configuracion))
    configs = result.scalars().all()
    
    config_dict = {c.clave: c.valor for c in configs}
    
    # Ocultar la contraseña SMTP por seguridad al mostrar en UI
    smtp_pass = config_dict.get("smtp_password", "")
    masked_pass = "••••••••" if smtp_pass else ""

    return {
        "etl": {
            "etl_intervalo_minutos": int(config_dict.get("etl_intervalo_minutos", 5)),
            "etl_hora_cierre_diario": config_dict.get("etl_hora_cierre_diario", "02:00"),
        },
        "smtp": {
            "smtp_host": config_dict.get("smtp_host", "smtp.gmail.com"),
            "smtp_port": int(config_dict.get("smtp_port", 587)),
            "smtp_user": config_dict.get("smtp_user", "alertas@quantix.local"),
            "smtp_password": masked_pass,
            "tiene_password": bool(smtp_pass),
        },
        "politicas": {
            "caja_tolerancia_descuadre": float(config_dict.get("caja_tolerancia_descuadre", 5.00)),
            "fefo_alerta_dias_1": int(config_dict.get("fefo_alerta_dias_1", 15)),
            "fefo_alerta_dias_2": int(config_dict.get("fefo_alerta_dias_2", 30)),
        }
    }

@router.put("")
async def actualizar_configuraciones(
    payload: ConfiguracionBulkUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(director_required)
):
    """
    Actualiza parámetros globales y aplica hot-reload si cambia la frecuencia del ETL.
    Exclusivo para el rol DIRECTOR.
    """
    etl_reprogramado = False
    nuevo_intervalo = None

    for item in payload.items:
        # Si la contraseña SMTP viene vacía o como asteriscos, no sobreescribir la existente
        if item.clave == "smtp_password" and (not item.valor or item.valor == "••••••••"):
            continue

        res = await db.execute(select(Configuracion).where(Configuracion.clave == item.clave))
        config_obj = res.scalar_one_or_none()
        
        if config_obj:
            config_obj.valor = str(item.valor)
            config_obj.modificado_por = current_user.id
            config_obj.modificado_en = datetime.utcnow()
        else:
            db.add(Configuracion(
                clave=item.clave,
                valor=str(item.valor),
                modificado_por=current_user.id,
                modificado_en=datetime.utcnow()
            ))

        if item.clave == "etl_intervalo_minutos":
            etl_reprogramado = True
            nuevo_intervalo = int(item.valor)

    await db.commit()

    # Hot-reload del Scheduler de ETL
    if etl_reprogramado and nuevo_intervalo:
        try:
            reschedule_etl(nuevo_intervalo)
        except Exception as e:
            pass

    return {"mensaje": "Parámetros actualizados exitosamente", "hot_reload_etl": etl_reprogramado}

@router.post("/etl/sincronizar-ahora", response_model=ETLTriggerResponse)
@router.post("/forzar-etl", response_model=ETLTriggerResponse)
async def forzar_sincronizacion_etl(
    background_tasks: BackgroundTasks,
    current_user: Usuario = Depends(director_required)
):
    """
    Dispara la ejecución del pipeline Medallion ETL hacia DuckDB inmediatamente.
    Exclusivo para el rol DIRECTOR.
    """
    background_tasks.add_task(trigger_etl_now)
    return {
        "mensaje": "Pipeline Medallion ETL iniciado en segundo plano. La capa Gold se actualizará en unos segundos.",
        "timestamp": datetime.utcnow()
    }

@router.post("/smtp/probar")
async def probar_correo_smtp(
    req: SMTPTestRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(director_required)
):
    """
    Envía un correo de prueba para verificar conectividad y credenciales SMTP.
    Exclusivo para el rol DIRECTOR.
    """
    # Consultar credenciales actuales
    res = await db.execute(select(Configuracion))
    configs = {c.clave: c.valor for c in res.scalars().all()}
    
    asunto = "✅ Prueba de Conectividad - Quantix POS"
    cuerpo = f"""
    Hola {current_user.nombre},

    Este es un correo de prueba enviado desde Quantix Retail OS.
    Tus credenciales y servidor SMTP ({configs.get('smtp_host', 'default')}:{configs.get('smtp_port', '587')}) están configurados correctamente.

    Fecha del test: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}
    """

    exito = EmailSender.enviar_correo(
        destinatarios=[req.destinatario],
        asunto=asunto,
        contenido_texto=cuerpo
    )

    if not exito:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al conectar con el servidor SMTP. Verifica el host, puerto o contraseña de aplicación."
        )

    return {"mensaje": f"Correo de prueba enviado exitosamente a {req.destinatario}"}
