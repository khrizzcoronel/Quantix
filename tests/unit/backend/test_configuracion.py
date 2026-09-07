import pytest
from app.api.configuracion import CONFIGS_DEFAULT
from app.etl.scheduler import reschedule_etl

def test_configuracion__default_keys_exist_and_have_types():
    """Verifica que los parámetros críticos de la arquitectura estén presentes y tipados"""
    claves_criticas = [
        "etl_intervalo_minutos",
        "caja_tolerancia_descuadre",
        "fefo_alerta_dias_1",
        "fefo_alerta_dias_2",
        "smtp_host",
        "smtp_port"
    ]
    for k in claves_criticas:
        assert k in CONFIGS_DEFAULT
        valor_defecto, desc, tipo = CONFIGS_DEFAULT[k]
        assert isinstance(valor_defecto, str)
        assert isinstance(desc, str)
        assert tipo in ["STRING", "INTEGER", "DECIMAL", "BOOLEAN"]

def test_configuracion__etl_interval_types():
    val, _, tipo = CONFIGS_DEFAULT["etl_intervalo_minutos"]
    assert tipo == "INTEGER"
    assert int(val) == 5

def test_configuracion__caja_tolerancia_types():
    val, _, tipo = CONFIGS_DEFAULT["caja_tolerancia_descuadre"]
    assert tipo == "DECIMAL"
    assert float(val) == 5.00
