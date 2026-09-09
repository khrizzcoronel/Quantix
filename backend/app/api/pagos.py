from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.api.deps import RoleChecker, get_current_user
from app.db.oltp import get_db
from app.models.pagos import IntentoPago
from app.models.usuarios import AuditoriaEvento, Usuario
from app.schemas.pagos import ConciliarIntentoRequest, IntentoPagoResponse
from app.services.payment_gateway import SimulatedPaymentGateway


router = APIRouter()
supervisor_o_director = RoleChecker(["SUPERVISOR", "DIRECTOR"])


@router.get("/intentos/{checkout_key}", response_model=list[IntentoPagoResponse])
async def consultar_intentos(
    checkout_key: str,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    query = select(IntentoPago).where(IntentoPago.checkout_idempotency_key == checkout_key)
    rol = getattr(current_user.rol, "value", current_user.rol)
    if rol not in {"SUPERVISOR", "DIRECTOR"}:
        query = query.where(IntentoPago.usuario_id == current_user.id)
    return (await db.execute(query.order_by(IntentoPago.indice))).scalars().all()


@router.post(
    "/intentos/{intento_id}/conciliar",
    response_model=IntentoPagoResponse,
    dependencies=[Depends(supervisor_o_director)],
)
async def conciliar_intento(
    intento_id: UUID,
    req: ConciliarIntentoRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    intento = await db.get(IntentoPago, intento_id)
    if not intento:
        raise HTTPException(status_code=404, detail="Intento de pago no encontrado")
    if intento.estado not in {"INICIADO", "INCIERTO"}:
        raise HTTPException(status_code=409, detail="El intento ya tiene un resultado definitivo")
    intento.estado = req.resultado
    intento.codigo_respuesta = "00" if req.resultado == "APROBADO" else "05"
    if req.resultado == "APROBADO" and not intento.referencia_pasarela:
        resultado = await SimulatedPaymentGateway.authorize_and_capture(
            amount=intento.monto,
            scenario_token="SIM-APPROVED",
            idempotency_key=f"{intento.checkout_idempotency_key}:{intento.indice}",
        )
        intento.referencia_pasarela = resultado.transaction_id
    intento.detalle = req.detalle or "Conciliación manual de la pasarela simulada"
    db.add(AuditoriaEvento(
        usuario_id=intento.usuario_id,
        usuario_autorizador_id=current_user.id,
        tipo_evento="CONCILIACION_PAGO",
        descripcion=f"Intento {intento.id} conciliado como {req.resultado}",
        gravedad="INFO" if req.resultado == "APROBADO" else "MEDIA",
        detalle_json={
            "intento_pago_id": str(intento.id),
            "checkout_idempotency_key": intento.checkout_idempotency_key,
            "resultado": req.resultado,
        },
    ))
    await db.commit()
    await db.refresh(intento)
    return intento
