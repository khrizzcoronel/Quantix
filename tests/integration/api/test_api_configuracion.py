import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_configuracion__director_obtiene_parametros__retorna_200(
    async_client: AsyncClient, 
    director_headers: dict
):
    """El Director puede consultar la suite completa de parámetros globales"""
    response = await async_client.get("/api/v1/configuracion", headers=director_headers)
    assert response.status_code == 200
    data = response.json()
    assert "etl" in data
    assert "smtp" in data
    assert "politicas" in data
    assert data["etl"]["etl_intervalo_minutos"] == 5

@pytest.mark.asyncio
async def test_configuracion__cajero_intenta_leer__retorna_403_forbidden(
    async_client: AsyncClient, 
    cajero_headers: dict
):
    """El Cajero tiene prohibido el acceso al módulo de configuración (RBAC)"""
    response = await async_client.get("/api/v1/configuracion", headers=cajero_headers)
    assert response.status_code == 403
    assert "permisos insuficientes" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_configuracion__director_actualiza_intervalo_etl__aplica_hot_reload(
    async_client: AsyncClient, 
    director_headers: dict
):
    """El Director puede actualizar la frecuencia del ETL y reprogramar en caliente"""
    payload = {
        "items": [
            {"clave": "etl_intervalo_minutos", "valor": "10"},
            {"clave": "caja_tolerancia_descuadre", "valor": "8.00"}
        ]
    }
    response = await async_client.put("/api/v1/configuracion", json=payload, headers=director_headers)
    assert response.status_code == 200
    assert response.json()["hot_reload_etl"] is True

    # Verificar que el nuevo valor persiste
    get_res = await async_client.get("/api/v1/configuracion", headers=director_headers)
    assert get_res.json()["etl"]["etl_intervalo_minutos"] == 10
    assert get_res.json()["politicas"]["caja_tolerancia_descuadre"] == 8.00

@pytest.mark.asyncio
async def test_configuracion__director_fuerza_sincronizacion_etl__retorna_200(
    async_client: AsyncClient, 
    director_headers: dict
):
    """El Director puede ejecutar la sincronización de DuckDB bajo demanda"""
    response = await async_client.post("/api/v1/configuracion/etl/sincronizar-ahora", headers=director_headers)
    assert response.status_code == 200
    assert "iniciado" in response.json()["mensaje"].lower()
