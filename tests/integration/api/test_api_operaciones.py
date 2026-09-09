import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_operaciones__director_obtiene_estado_etl__retorna_200(
    async_client: AsyncClient,
    director_headers: dict
):
    """El Director puede consultar el estado del motor ETL Medallion y DuckDB"""
    response = await async_client.get("/api/v1/operaciones/etl/estado", headers=director_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ONLINE"
    assert "archivo_duckdb" in data
    assert "scheduler" in data
    assert "ultima_ejecucion" in data

@pytest.mark.asyncio
async def test_operaciones__cajero_intenta_consultar_estado__retorna_403(
    async_client: AsyncClient,
    cajero_headers: dict
):
    """Un cajero no tiene autorización para acceder al módulo de operaciones"""
    response = await async_client.get("/api/v1/operaciones/etl/estado", headers=cajero_headers)
    assert response.status_code == 403

@pytest.mark.asyncio
async def test_operaciones__director_ejecuta_etl_manual__retorna_200_con_metricas(
    async_client: AsyncClient,
    director_headers: dict
):
    """La ejecución manual del ETL dispara el pipeline y devuelve métricas detalladas"""
    response = await async_client.post("/api/v1/operaciones/etl/ejecutar", headers=director_headers)
    assert response.status_code == 200
    data = response.json()
    assert "resultado" in data
    assert data["resultado"]["status"] == "EXITOSO"
    assert "duracion_ms" in data["resultado"]
    assert "filas" in data["resultado"]

@pytest.mark.asyncio
async def test_operaciones__director_reprograma_scheduler__retorna_200(
    async_client: AsyncClient,
    director_headers: dict
):
    """El Director puede reprogramar en caliente el intervalo del scheduler"""
    response = await async_client.post(
        "/api/v1/operaciones/etl/reprogramar",
        json={"intervalo_minutos": 15},
        headers=director_headers
    )
    assert response.status_code == 200
    assert response.json()["nuevo_intervalo"] == 15

@pytest.mark.asyncio
async def test_configuracion__alias_forzar_etl_legacy__retorna_200(
    async_client: AsyncClient,
    director_headers: dict
):
    """El alias retrocompatible /configuracion/forzar-etl responde 200"""
    response = await async_client.post("/api/v1/configuracion/forzar-etl", headers=director_headers)
    assert response.status_code == 200

@pytest.mark.asyncio
async def test_operaciones__director_obtiene_historial_trazabilidad__retorna_200(
    async_client: AsyncClient,
    director_headers: dict
):
    """El Director puede consultar la bitácora de trazabilidad histórica del ETL"""
    response = await async_client.get("/api/v1/operaciones/etl/historial?limit=10", headers=director_headers)
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "registros" in data
    assert isinstance(data["registros"], list)
