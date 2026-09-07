from datetime import date, timedelta
from decimal import Decimal
from app.models.ventas import Cupon, EstadoCupon, DescuentoTipo, TipoCupon

def validar_y_calcular_cupon(cupon: Cupon, total_venta: Decimal):
    hoy = date.today()
    if cupon.estado != EstadoCupon.EMITIDO:
        return False, Decimal("0.00"), "El cupón ya ha sido canjeado o está inactivo."
    if cupon.valido_desde > hoy or cupon.valido_hasta < hoy:
        return False, Decimal("0.00"), "El cupón está fuera de su fecha de vigencia."
    
    if cupon.descuento_tipo == DescuentoTipo.PORCENTAJE:
        descuento = (total_venta * cupon.descuento_valor) / Decimal("100.00")
    else:
        descuento = min(cupon.descuento_valor, total_venta)

    return True, descuento, "Cupón válido"

def test_cupon__percentage_discount__computes_percentage():
    cupon = Cupon(
        codigo="PROMO15",
        tipo=TipoCupon.MANUAL,
        descuento_tipo=DescuentoTipo.PORCENTAJE,
        descuento_valor=Decimal("15.00"),
        valido_desde=date.today() - timedelta(days=1),
        valido_hasta=date.today() + timedelta(days=7),
        estado=EstadoCupon.EMITIDO
    )
    valido, monto, _ = validar_y_calcular_cupon(cupon, Decimal("200.00"))
    assert valido is True
    assert monto == Decimal("30.00")

def test_cupon__fixed_amount_discount__computes_fixed():
    cupon = Cupon(
        codigo="FIJO50",
        tipo=TipoCupon.MANUAL,
        descuento_tipo=DescuentoTipo.MONTO_FIJO,
        descuento_valor=Decimal("50.00"),
        valido_desde=date.today() - timedelta(days=1),
        valido_hasta=date.today() + timedelta(days=7),
        estado=EstadoCupon.EMITIDO
    )
    valido, monto, _ = validar_y_calcular_cupon(cupon, Decimal("120.00"))
    assert valido is True
    assert monto == Decimal("50.00")

def test_cupon__expired__is_rejected():
    cupon = Cupon(
        codigo="EXPIRADO",
        tipo=TipoCupon.MANUAL,
        descuento_tipo=DescuentoTipo.PORCENTAJE,
        descuento_valor=Decimal("10.00"),
        valido_desde=date.today() - timedelta(days=20),
        valido_hasta=date.today() - timedelta(days=1),
        estado=EstadoCupon.EMITIDO
    )
    valido, monto, msg = validar_y_calcular_cupon(cupon, Decimal("100.00"))
    assert valido is False
    assert monto == Decimal("0.00")
    assert "vigencia" in msg
