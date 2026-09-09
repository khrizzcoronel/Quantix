from fastapi import APIRouter, WebSocket, WebSocketDisconnect, WebSocketException, status, Query
from typing import Dict, List, Optional, Any
from uuid import UUID
import json
import logging
import uuid
import asyncio
from jose import jwt, JWTError
from sqlalchemy import select
from datetime import datetime, timezone
from app.core.config import settings
from app.db.oltp import async_session_factory
from app.models.usuarios import Usuario

logger = logging.getLogger(__name__)
router = APIRouter()

class ConnectionManager:
    def __init__(self):
        # Mapea el UUID del usuario a su(s) conexión(es) WebSocket activas
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.main_loop: Optional[asyncio.AbstractEventLoop] = None

    def set_event_loop(self, loop: asyncio.AbstractEventLoop):
        self.main_loop = loop

    async def connect(self, websocket: WebSocket, usuario_id: str):
        await websocket.accept()
        if usuario_id not in self.active_connections:
            self.active_connections[usuario_id] = []
        self.active_connections[usuario_id].append(websocket)
        try:
            self.main_loop = asyncio.get_running_loop()
        except RuntimeError:
            pass
        logger.info(f"Usuario {usuario_id} conectado a WebSockets. Total conexiones usuario: {len(self.active_connections[usuario_id])}")

    def disconnect(self, websocket: WebSocket, usuario_id: str):
        if usuario_id in self.active_connections:
            if websocket in self.active_connections[usuario_id]:
                self.active_connections[usuario_id].remove(websocket)
            if not self.active_connections[usuario_id]:
                del self.active_connections[usuario_id]
        logger.info(f"Usuario {usuario_id} desconectado de WebSockets.")

    async def send_personal_message(self, message: dict, usuario_id: str):
        """Empuja una notificación a un usuario en específico"""
        if usuario_id in self.active_connections:
            for connection in list(self.active_connections[usuario_id]):
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.debug(f"Error al enviar mensaje personal a {usuario_id}: {e}")
                    
    async def broadcast(self, message: dict):
        """Empuja una notificación a todos los usuarios conectados (Ej. Mantenimiento del servidor)"""
        for user_id, connections in list(self.active_connections.items()):
            for connection in list(connections):
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.debug(f"Error al enviar broadcast a conexión de {user_id}: {e}")

    async def broadcast_alerta(
        self, 
        tipo: str, 
        titulo: str, 
        mensaje: str, 
        severidad: str = "INFO", 
        payload: Optional[dict] = None
    ) -> dict:
        """
        Emite una alerta con severidad (INFO, SUCCESS, WARNING, CRITICO) a todos los usuarios conectados.
        """
        alerta = {
            "id": str(uuid.uuid4()),
            "tipo": tipo,
            "titulo": titulo,
            "mensaje": mensaje,
            "severidad": severidad.upper(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": payload or {}
        }
        await self.broadcast(alerta)
        logger.info(f"Alerta WS emitida [{alerta['severidad']}] {tipo}: {titulo}")
        return alerta

    async def notificar_evento(self, evento_dict: dict) -> dict:
        """
        Emite un evento en tiempo real para supervisión táctica (ventas, anulaciones, arqueos, etc.).
        """
        if "id" not in evento_dict:
            evento_dict["id"] = str(uuid.uuid4())
        if "timestamp" not in evento_dict:
            evento_dict["timestamp"] = datetime.now(timezone.utc).isoformat()
        if "severidad" not in evento_dict:
            evento_dict["severidad"] = "INFO"
        await self.broadcast(evento_dict)
        logger.info(f"Evento WS notificado [{evento_dict.get('tipo', 'EVENTO')}]: {evento_dict.get('titulo', '')}")
        return evento_dict

    def emit_alerta_sync(
        self,
        tipo: str,
        titulo: str,
        mensaje: str,
        severidad: str = "INFO",
        payload: Optional[dict] = None
    ) -> dict:
        """
        Wrapper síncrono/thread-safe para emitir alertas desde hilos en segundo plano (APScheduler, ETL).
        """
        alerta = {
            "id": str(uuid.uuid4()),
            "tipo": tipo,
            "titulo": titulo,
            "mensaje": mensaje,
            "severidad": severidad.upper(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": payload or {}
        }
        self._dispatch_background(alerta)
        return alerta

    def emit_evento_sync(self, evento_dict: dict) -> dict:
        """
        Wrapper síncrono/thread-safe para notificar eventos desde hilos en segundo plano.
        """
        if "id" not in evento_dict:
            evento_dict["id"] = str(uuid.uuid4())
        if "timestamp" not in evento_dict:
            evento_dict["timestamp"] = datetime.now(timezone.utc).isoformat()
        if "severidad" not in evento_dict:
            evento_dict["severidad"] = "INFO"
        self._dispatch_background(evento_dict)
        return evento_dict

    def _dispatch_background(self, message: dict):
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self.broadcast(message))
        except RuntimeError:
            if self.main_loop and self.main_loop.is_running():
                asyncio.run_coroutine_threadsafe(self.broadcast(message), self.main_loop)
            else:
                logger.debug(f"No hay event loop disponible para despachar mensaje WS: {message.get('tipo')}")

# Instancia global del manejador de conexiones
notif_manager = ConnectionManager()

@router.websocket("/stream")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    """
    Endpoint WebSocket para notificaciones. 
    Nota de Seguridad: En producción, el token JWT suele validarse extrayéndolo
    de un query parameter (ej. ?token=...) debido a las limitaciones de los headers 
    en el objeto nativo WebSocket de Javascript.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        usuario_id = payload.get("sub")
        if not usuario_id:
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)
        async with async_session_factory() as session:
            result = await session.execute(select(Usuario).where(Usuario.id == usuario_id))
            usuario = result.scalar_one_or_none()
            if not usuario or not usuario.activo:
                raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)
    except (JWTError, ValueError):
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)

    await notif_manager.connect(websocket, usuario_id)
    try:
        while True:
            # Mantener la conexión abierta y escuchar por 'pings' del cliente
            data = await websocket.receive_text()
            try:
                msg_parsed = json.loads(data)
                payload = msg_parsed.get("payload", data)
            except Exception:
                payload = data
            # Respondemos un pong para confirmación de keep-alive
            await websocket.send_text(json.dumps({
                "tipo": "PONG",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "payload": payload
            }))
    except WebSocketDisconnect:
        notif_manager.disconnect(websocket, usuario_id)
    except Exception as e:
        logger.warning(f"Excepción en conexión WS ({usuario_id}): {e}")
        notif_manager.disconnect(websocket, usuario_id)
