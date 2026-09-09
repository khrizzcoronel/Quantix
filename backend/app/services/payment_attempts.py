from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.oltp import AsyncSessionLocal
from app.models.pagos import IntentoPago


async def obtener_intento(checkout_key: str, indice: int) -> Optional[IntentoPago]:
    async with AsyncSessionLocal() as session:
        return await session.scalar(
            select(IntentoPago).where(
                IntentoPago.checkout_idempotency_key == checkout_key,
                IntentoPago.indice == indice,
            )
        )


async def iniciar_intento(
    *, checkout_key: str, indice: int, usuario_id: UUID, sesion_caja_id: UUID,
    metodo_pago: str, monto: Decimal, escenario: Optional[str],
) -> tuple[IntentoPago, bool]:
    existente = await obtener_intento(checkout_key, indice)
    if existente:
        return existente, False

    async with AsyncSessionLocal() as session:
        intento = IntentoPago(
            checkout_idempotency_key=checkout_key,
            indice=indice,
            usuario_id=usuario_id,
            sesion_caja_id=sesion_caja_id,
            metodo_pago=metodo_pago,
            monto=monto,
            estado="INICIADO",
            escenario_simulado=escenario,
        )
        session.add(intento)
        try:
            await session.commit()
            await session.refresh(intento)
            return intento, True
        except IntegrityError:
            await session.rollback()
            existente = await obtener_intento(checkout_key, indice)
            if not existente:
                raise
            return existente, False


async def actualizar_intento(
    intento_id: UUID, *, estado: str, referencia: Optional[str] = None,
    codigo: Optional[str] = None, detalle: Optional[str] = None,
    venta_id: Optional[UUID] = None,
) -> None:
    async with AsyncSessionLocal() as session:
        intento = await session.get(IntentoPago, intento_id)
        if not intento:
            return
        intento.estado = estado
        if referencia is not None:
            intento.referencia_pasarela = referencia
        if codigo is not None:
            intento.codigo_respuesta = codigo
        if detalle is not None:
            intento.detalle = detalle
        if venta_id is not None:
            intento.venta_id = venta_id
        await session.commit()
