import pytest
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock
from app.api.ws import ConnectionManager

@pytest.mark.asyncio
async def test_connection_manager_broadcast_alerta():
    manager = ConnectionManager()
    mock_ws = AsyncMock()
    mock_ws.send_json = AsyncMock()
    
    # Simular conexión
    manager.active_connections["user-123"] = [mock_ws]
    
    alerta = await manager.broadcast_alerta(
        tipo="ARQUEO_DESCUADRE",
        titulo="Descuadre Detectado",
        mensaje="Diferencia de $60.00",
        severidad="critico",
        payload={"diferencia": -60.0}
    )
    
    assert alerta["tipo"] == "ARQUEO_DESCUADRE"
    assert alerta["titulo"] == "Descuadre Detectado"
    assert alerta["severidad"] == "CRITICO"
    assert alerta["payload"]["diferencia"] == -60.0
    assert "id" in alerta
    assert "timestamp" in alerta
    
    mock_ws.send_json.assert_awaited_once_with(alerta)

@pytest.mark.asyncio
async def test_connection_manager_notificar_evento():
    manager = ConnectionManager()
    mock_ws = AsyncMock()
    mock_ws.send_json = AsyncMock()
    
    manager.active_connections["user-456"] = [mock_ws]
    
    evento = await manager.notificar_evento({
        "tipo": "VENTA_REALIZADA",
        "titulo": "Venta #TKT-100",
        "mensaje": "Venta de $250.00",
        "severidad": "SUCCESS",
        "payload": {"total": 250.0}
    })
    
    assert evento["tipo"] == "VENTA_REALIZADA"
    assert "id" in evento
    assert "timestamp" in evento
    assert evento["severidad"] == "SUCCESS"
    mock_ws.send_json.assert_awaited_once_with(evento)

@pytest.mark.asyncio
async def test_sync_emitters():
    manager = ConnectionManager()
    loop = asyncio.get_running_loop()
    manager.set_event_loop(loop)
    
    mock_ws = AsyncMock()
    mock_ws.send_json = AsyncMock()
    manager.active_connections["user-789"] = [mock_ws]
    
    alerta = manager.emit_alerta_sync(
        tipo="ETL_SYNC",
        titulo="Sincronización Completada",
        mensaje="ETL exitoso",
        severidad="success"
    )
    assert alerta["severidad"] == "SUCCESS"
    assert alerta["tipo"] == "ETL_SYNC"
    
    # Permitir que la tarea en background se ejecute
    await asyncio.sleep(0.05)
    mock_ws.send_json.assert_awaited()
