import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_obtener_mi_perfil(async_client: AsyncClient, cajero_headers: dict):
    """Consulta GET /api/v1/usuarios/me devuelve datos de current_user."""
    response = await async_client.get("/api/v1/usuarios/me", headers=cajero_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "cajero@quantix.local"
    assert data["nombre"] == "Cajero Test"
    assert data["rol"] == "CAJERO"
    assert data["activo"] is True
    assert "id" in data
    assert "avatar" in data
    assert "telefono" in data
    assert "creado_en" in data


@pytest.mark.asyncio
async def test_actualizar_mi_perfil_datos_basicos(async_client: AsyncClient, cajero_headers: dict):
    """PUT /api/v1/usuarios/me actualiza nombre, telefono y avatar exitosamente."""
    nuevo_nombre = "Cajero Modificado"
    nuevo_telefono = "+52 55 1234 5678"
    nuevo_avatar = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    response = await async_client.put(
        "/api/v1/usuarios/me",
        json={
            "nombre": nuevo_nombre,
            "telefono": nuevo_telefono,
            "avatar": nuevo_avatar,
        },
        headers=cajero_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["nombre"] == nuevo_nombre
    assert data["telefono"] == nuevo_telefono
    assert data["avatar"] == nuevo_avatar

    # Confirmar persistencia vía GET /me
    me_resp = await async_client.get("/api/v1/usuarios/me", headers=cajero_headers)
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["nombre"] == nuevo_nombre
    assert me_data["telefono"] == nuevo_telefono
    assert me_data["avatar"] == nuevo_avatar


@pytest.mark.asyncio
async def test_actualizar_mi_perfil_email_duplicado(async_client: AsyncClient, director_headers: dict, cajero_headers: dict):
    """PUT /api/v1/usuarios/me con email de otro usuario retorna HTTP 400."""
    email_otro = "otro_existente@quantix.com"
    res_crear = await async_client.post(
        "/api/v1/usuarios",
        json={
            "nombre": "Otro Usuario",
            "email": email_otro,
            "password": "Password123!",
            "rol": "CAJERO",
        },
        headers=director_headers,
    )
    assert res_crear.status_code == 201

    response = await async_client.put(
        "/api/v1/usuarios/me",
        json={"email": email_otro},
        headers=cajero_headers,
    )
    assert response.status_code == 400
    detail = response.json().get("detail", "")
    assert "Ya existe otro usuario con este correo electrónico" in detail


@pytest.mark.asyncio
async def test_actualizar_mi_perfil_password_incorrecto(async_client: AsyncClient, cajero_headers: dict):
    """Cambiar password con password_actual erróneo retorna HTTP 400."""
    response = await async_client.put(
        "/api/v1/usuarios/me",
        json={
            "password_actual": "PasswordErroneo123!",
            "password_nuevo": "NuevaClaveSegura123!",
        },
        headers=cajero_headers,
    )
    assert response.status_code == 400
    detail = response.json().get("detail", "")
    assert "La contraseña actual es incorrecta" in detail


@pytest.mark.asyncio
async def test_actualizar_mi_perfil_password_exitoso(async_client: AsyncClient, cajero_headers: dict):
    """Cambiar password con password_actual correcto y login posterior exitoso."""
    nueva_password = "NuevaClaveValida123!"

    # 1. Cambiar contraseña
    response = await async_client.put(
        "/api/v1/usuarios/me",
        json={
            "password_actual": "Caja123!",
            "password_nuevo": nueva_password,
        },
        headers=cajero_headers,
    )
    assert response.status_code == 200

    # 2. Login posterior con nueva contraseña
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "cajero@quantix.local", "password": nueva_password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    assert "access_token" in login_data
    assert login_data["user"]["email"] == "cajero@quantix.local"
    assert "telefono" in login_data["user"]
