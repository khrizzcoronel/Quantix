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


@pytest.mark.asyncio
async def test_buscar_por_cedula_y_registro_rapido(async_client: AsyncClient, director_headers: dict):
    """
    Verifica el flujo del usuario:
    1. Búsqueda de cliente por cédula inexistente -> 404.
    2. Registro rápido con cédula, nombre, celular y correo -> 201.
    3. Búsqueda inmediata por cédula -> 200 con todos los datos.
    4. Rechazo ante intento de duplicar la misma cédula -> 400.
    """
    cedula_test = f"CED-{uuid.uuid4().hex[:8].upper()}"
    celular_test = f"55{uuid.uuid4().int % 100000000:08d}"

    # 1. Búsqueda de cédula inexistente
    res_404 = await async_client.get(f"/api/v1/crm/clientes/buscar/{cedula_test}", headers=director_headers)
    assert res_404.status_code == 404

    # 2. Registro rápido
    res_crear = await async_client.post(
        "/api/v1/crm/clientes",
        json={
            "cedula": cedula_test,
            "nombre": "Carlos Mendoza",
            "telefono": celular_test,
            "email": "carlos.mendoza@ejemplo.com"
        },
        headers=director_headers
    )
    assert res_crear.status_code == 201
    cliente = res_crear.json()
    assert cliente["cedula"] == cedula_test
    assert cliente["nombre"] == "Carlos Mendoza"
    assert cliente["telefono"] == celular_test
    assert cliente["email"] == "carlos.mendoza@ejemplo.com"

    # 3. Búsqueda por cédula
    res_busqueda = await async_client.get(f"/api/v1/crm/clientes/buscar/{cedula_test}", headers=director_headers)
    assert res_busqueda.status_code == 200
    assert res_busqueda.json()["id"] == cliente["id"]
    assert res_busqueda.json()["cedula"] == cedula_test

    # 4. Rechazo de cédula duplicada
    res_dup = await async_client.post(
        "/api/v1/crm/clientes",
        json={
            "cedula": cedula_test,
            "nombre": "Otro Cliente",
            "telefono": f"55{uuid.uuid4().int % 100000000:08d}",
            "email": "otro@ejemplo.com"
        },
        headers=director_headers
    )
    assert res_dup.status_code == 400
    assert "Ya existe un cliente con esta cédula" in res_dup.json()["detail"]

