import pytest
from decimal import Decimal

def calcular_descuadre(teorico: Decimal, fisico: Decimal, tolerancia: Decimal = Decimal("5.00")):
    diferencia = fisico - teorico
    abs_dif = abs(diferencia)
    
    if abs_dif <= tolerancia:
        estado = "OK"
        requiere_auditoria = False
    elif diferencia > tolerancia:
        estado = "SOBRANTE"
        requiere_auditoria = True
    else:
        estado = "DESCUADRE"
        requiere_auditoria = True
        
    return diferencia, estado, requiere_auditoria

def test_arqueo__exact_match__returns_status_ok():
    """Arqueo exacto donde físico == teórico"""
    dif, estado, auditoria = calcular_descuadre(Decimal("1000.00"), Decimal("1000.00"))
    assert dif == Decimal("0.00")
    assert estado == "OK"
    assert auditoria is False

def test_arqueo__within_tolerance__returns_ok_without_audit():
    """Descuadre de $3.50 está dentro de la tolerancia máxima de $5.00"""
    dif, estado, auditoria = calcular_descuadre(Decimal("500.00"), Decimal("496.50"))
    assert dif == Decimal("-3.50")
    assert estado == "OK"
    assert auditoria is False

def test_arqueo__exceeds_tolerance_negative__triggers_audit():
    """Faltante de -$15.00 excede los $5.00 de tolerancia y exige auditoría forense"""
    dif, estado, auditoria = calcular_descuadre(Decimal("800.00"), Decimal("785.00"))
    assert dif == Decimal("-15.00")
    assert estado == "DESCUADRE"
    assert auditoria is True

def test_arqueo__exceeds_tolerance_positive__triggers_sobrante():
    """Sobrante de +$20.00 excede tolerancia y activa auditoría"""
    dif, estado, auditoria = calcular_descuadre(Decimal("400.00"), Decimal("420.00"))
    assert dif == Decimal("20.00")
    assert estado == "SOBRANTE"
    assert auditoria is True
