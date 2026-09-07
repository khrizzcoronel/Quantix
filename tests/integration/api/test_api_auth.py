import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_login__valid_credentials__returns_token_and_user_with_role(async_client: AsyncClient):
    """Prueba que el login retorne access_token y el objeto user con su rol"""
    response = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "admin@quantix.local", "password": "Admin123!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "admin@quantix.local"
    assert data["user"]["rol"] == "DIRECTOR"

@pytest.mark.asyncio
async def test_login__invalid_password__returns_400(async_client: AsyncClient):
    """Prueba que contraseñas erróneas sean rechazadas"""
    response = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "admin@quantix.local", "password": "PasswordIncorrecta!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert response.status_code == 400
    assert "incorrectos" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_login__cajero_credentials__returns_cajero_role(async_client: AsyncClient):
    """Verifica que el usuario cajero obtenga su rol correspondiente"""
    response = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "cajero@quantix.local", "password": "Caja123!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert response.status_code == 200
    assert response.json()["user"]["rol"] == "CAJERO"

@pytest.mark.asyncio
async def test_supervisor_override__valid_credentials__returns_authorized(async_client: AsyncClient):
    """Prueba de pase de supervisor (override en caliente)"""
    response = await async_client.post(
        "/api/v1/auth/supervisor-override",
        json={
            "email": "supervisor@quantix.local",
            "password": "Super123!",
            "motivo": "Autorización test de anulación"
        }
    )
    assert response.status_code == 200
    assert response.json()["autorizado"] is True
