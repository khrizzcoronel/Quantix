import pytest
from httpx import AsyncClient
import uuid

@pytest.mark.asyncio
async def test_usuarios_crud_completo_con_baja_logica(async_client: AsyncClient, director_headers: dict, cajero_headers: dict):
    # 1. Cajero no puede listar ni crear usuarios (RBAC)
    res_forbidden = await async_client.get("/api/v1/usuarios", headers=cajero_headers)
    assert res_forbidden.status_code == 403

    # 2. Director crea un nuevo usuario operador
    email_user = f"operador_{uuid.uuid4().hex[:6]}@quantix.local"
    res_crear = await async_client.post(
        "/api/v1/usuarios",
        json={
            "nombre": "Pedro Cajero Auxiliar",
            "email": email_user,
            "password": "Password123!",
            "rol": "CAJERO"
        },
        headers=director_headers
    )
    assert res_crear.status_code == 201
    user = res_crear.json()
    u_id = user["id"]
    assert user["activo"] is True
    assert user["rol"] == "CAJERO"

    # 3. Modificar usuario
    res_edit = await async_client.put(
        f"/api/v1/usuarios/{u_id}",
        json={"nombre": "Pedro Sánchez Cajero", "rol": "SUPERVISOR"},
        headers=director_headers
    )
    assert res_edit.status_code == 200
    assert res_edit.json()["nombre"] == "Pedro Sánchez Cajero"
    assert res_edit.json()["rol"] == "SUPERVISOR"

    # 4. Actualizar avatar del usuario
    res_avatar = await async_client.put(
        f"/api/v1/usuarios/{u_id}/avatar",
        json={"avatar": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD..."},
        headers=director_headers
    )
    assert res_avatar.status_code == 200
    assert "data:image/jpeg;base64" in res_avatar.json()["avatar"]

    # 5. Baja lógica (Desactivar usuario)
    res_baja = await async_client.delete(
        f"/api/v1/usuarios/{u_id}",
        headers=director_headers
    )
    assert res_baja.status_code == 200
    assert res_baja.json()["activo"] is False

    # 6. Listar filtrando por activos
    res_activos = await async_client.get("/api/v1/usuarios?activo_only=true", headers=director_headers)
    assert res_activos.status_code == 200
    ids_activos = [u["id"] for u in res_activos.json()]
    assert u_id not in ids_activos
