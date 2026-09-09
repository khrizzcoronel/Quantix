import pytest
from httpx import AsyncClient
import uuid

@pytest.mark.asyncio
async def test_crm_clientes_crud_completo_con_baja_logica(async_client: AsyncClient, director_headers: dict):
    # 1. Crear cliente
    tel = f"55{uuid.uuid4().int % 100000000:08d}"
    res_crear = await async_client.post(
        "/api/v1/crm/clientes",
        json={"telefono": tel, "nombre": "Laura Martínez", "email": "laura@example.com"},
        headers=director_headers
    )
    assert res_crear.status_code == 201
    cliente = res_crear.json()
    c_id = cliente["id"]
    assert cliente["activo"] is True
    assert cliente["telefono"] == tel

    # 2. Obtener por ID y por teléfono
    res_get = await async_client.get(f"/api/v1/crm/clientes/{c_id}", headers=director_headers)
    assert res_get.status_code == 200
    assert res_get.json()["nombre"] == "Laura Martínez"

    res_busq = await async_client.get(f"/api/v1/crm/clientes/buscar/{tel}", headers=director_headers)
    assert res_busq.status_code == 200
    assert res_busq.json()["id"] == c_id

    # 3. Modificar cliente
    res_edit = await async_client.put(
        f"/api/v1/crm/clientes/{c_id}",
        json={"nombre": "Laura Martínez de la Rosa", "puntos_acumulados": 150},
        headers=director_headers
    )
    assert res_edit.status_code == 200
    assert res_edit.json()["nombre"] == "Laura Martínez de la Rosa"
    assert res_edit.json()["puntos_acumulados"] == 150

    # 4. Baja lógica
    res_baja = await async_client.delete(f"/api/v1/crm/clientes/{c_id}", headers=director_headers)
    assert res_baja.status_code == 200
    assert res_baja.json()["activo"] is False

    # 5. Verificar lista con filtro activo_only
    res_activos = await async_client.get("/api/v1/crm/clientes?activo_only=true", headers=director_headers)
    assert res_activos.status_code == 200
    ids_activos = [c["id"] for c in res_activos.json()]
    assert c_id not in ids_activos
