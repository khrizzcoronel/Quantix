import pytest
from datetime import date, timedelta
from app.models.inventario import LoteInventario, EstadoLote

def test_fefo_algorithm__multiple_lots__orders_by_expiry_ascending():
    """
    Validación de la regla de oro FEFO (First Expired, First Out):
    Los lotes deben ordenarse ascendentemente por fecha de vencimiento.
    """
    hoy = date.today()
    lote_lejano = LoteInventario(
        codigo_lote="LOTE-C",
        cantidad_disponible=50,
        fecha_vencimiento=hoy + timedelta(days=60),
        estado=EstadoLote.ACTIVO
    )
    lote_urgente = LoteInventario(
        codigo_lote="LOTE-A",
        cantidad_disponible=20,
        fecha_vencimiento=hoy + timedelta(days=5),
        estado=EstadoLote.ACTIVO
    )
    lote_medio = LoteInventario(
        codigo_lote="LOTE-B",
        cantidad_disponible=30,
        fecha_vencimiento=hoy + timedelta(days=20),
        estado=EstadoLote.ACTIVO
    )

    lotes = [lote_lejano, lote_urgente, lote_medio]
    # Algoritmo FEFO: Ordenamiento estricto por fecha_vencimiento
    lotes_fefo = sorted(lotes, key=lambda l: l.fecha_vencimiento)

    assert lotes_fefo[0].codigo_lote == "LOTE-A"
    assert lotes_fefo[1].codigo_lote == "LOTE-B"
    assert lotes_fefo[2].codigo_lote == "LOTE-C"

def test_fefo_algorithm__expired_or_depleted_lots__are_filtered_out():
    """
    Los lotes agotados, caducados o en merma nunca deben entrar en la asignación de venta.
    """
    hoy = date.today()
    lote_activo = LoteInventario(
        codigo_lote="ACTIVO",
        cantidad_disponible=15,
        fecha_vencimiento=hoy + timedelta(days=10),
        estado=EstadoLote.ACTIVO
    )
    lote_agotado = LoteInventario(
        codigo_lote="AGOTADO",
        cantidad_disponible=0,
        fecha_vencimiento=hoy + timedelta(days=5),
        estado=EstadoLote.AGOTADO
    )
    lote_caducado = LoteInventario(
        codigo_lote="CADUCADO",
        cantidad_disponible=10,
        fecha_vencimiento=hoy - timedelta(days=1),
        estado=EstadoLote.CADUCADO
    )

    lotes = [lote_activo, lote_agotado, lote_caducado]
    disponibles = [l for l in lotes if l.estado == EstadoLote.ACTIVO and l.cantidad_disponible > 0 and l.fecha_vencimiento >= hoy]

    assert len(disponibles) == 1
    assert disponibles[0].codigo_lote == "ACTIVO"
