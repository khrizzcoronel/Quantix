from decimal import Decimal

import pytest

from app.services.payment_gateway import (
    PaymentDeclined,
    PaymentTimeout,
    SimulatedPaymentGateway,
)


@pytest.mark.asyncio
async def test_pasarela_simulada__aprobada__captura_con_referencia_determinista():
    first = await SimulatedPaymentGateway.authorize_and_capture(
        Decimal("116.00"), "SIM-APPROVED", "checkout-001"
    )
    second = await SimulatedPaymentGateway.authorize_and_capture(
        Decimal("116.00"), "SIM-APPROVED", "checkout-001"
    )
    assert first.status == "CAPTURADO"
    assert first.transaction_id == second.transaction_id


@pytest.mark.asyncio
async def test_pasarela_simulada__rechazada__no_confirma_pago():
    with pytest.raises(PaymentDeclined):
        await SimulatedPaymentGateway.authorize_and_capture(
            Decimal("116.00"), "SIM-DECLINED", "checkout-002"
        )


@pytest.mark.asyncio
async def test_pasarela_simulada__timeout__requiere_reconciliacion():
    with pytest.raises(PaymentTimeout):
        await SimulatedPaymentGateway.authorize_and_capture(
            Decimal("116.00"), "SIM-TIMEOUT", "checkout-003"
        )
