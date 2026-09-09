"""Pasarela determinista para desarrollo y pruebas sin datos bancarios reales."""

from dataclasses import dataclass
from decimal import Decimal
from hashlib import sha256


class PaymentGatewayError(Exception):
    """Error base de la pasarela simulada."""


class PaymentDeclined(PaymentGatewayError):
    pass


class PaymentTimeout(PaymentGatewayError):
    pass


@dataclass(frozen=True)
class PaymentResult:
    transaction_id: str
    status: str
    amount: Decimal
    response_code: str


class SimulatedPaymentGateway:
    """
    Emula autorización y captura.

    Tokens admitidos: SIM-APPROVED, SIM-DECLINED y SIM-TIMEOUT. El identificador
    generado es determinista para una misma clave, lo que permite probar reintentos.
    """

    @staticmethod
    async def authorize_and_capture(
        amount: Decimal,
        scenario_token: str | None,
        idempotency_key: str,
    ) -> PaymentResult:
        token = (scenario_token or "SIM-APPROVED").upper()
        if token == "SIM-DECLINED":
            raise PaymentDeclined("Pago rechazado por la pasarela simulada")
        if token == "SIM-TIMEOUT":
            raise PaymentTimeout("La pasarela simulada no respondió a tiempo")
        if token != "SIM-APPROVED":
            raise PaymentGatewayError("Escenario de pasarela simulada no reconocido")

        digest = sha256(f"{idempotency_key}:{amount}".encode("utf-8")).hexdigest()[:20].upper()
        return PaymentResult(
            transaction_id=f"SIMPAY-{digest}",
            status="CAPTURADO",
            amount=amount,
            response_code="00",
        )
