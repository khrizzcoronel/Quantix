from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import Dict, List
from uuid import UUID
import json
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class ConnectionManager:
    def __init__(self):
        # Mapea el UUID del usuario a su(s) conexión(es) WebSocket activas
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, usuario_id: str):
        await websocket.accept()
        if usuario_id not in self.active_connections:
            self.active_connections[usuario_id] = []
        self.active_connections[usuario_id].append(websocket)
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
            for connection in self.active_connections[usuario_id]:
                try:
                    await connection.send_json(message)
                except RuntimeError:
                    # La conexión podría estar en estado cerrado
                    pass
                    
    async def broadcast(self, message: dict):
        """Empuja una notificación a todos los usuarios conectados (Ej. Mantenimiento del servidor)"""
        for user_id, connections in self.active_connections.items():
            for connection in connections:
                try:
                    await connection.send_json(message)
                except RuntimeError:
                    pass

# Instancia global del manejador de conexiones
notif_manager = ConnectionManager()

@router.websocket("/stream/{usuario_id}")
async def websocket_endpoint(websocket: WebSocket, usuario_id: str):
    """
    Endpoint WebSocket para notificaciones. 
    Nota de Seguridad: En producción, el token JWT suele validarse extrayéndolo
    de un query parameter (ej. ?token=...) debido a las limitaciones de los headers 
    en el objeto nativo WebSocket de Javascript.
    """
    await notif_manager.connect(websocket, usuario_id)
    try:
        while True:
            # Mantener la conexión abierta y escuchar por 'pings' del cliente
            data = await websocket.receive_text()
            # Respondemos un pong para confirmación de keep-alive
            await websocket.send_text(json.dumps({"tipo": "PONG", "payload": data}))
    except WebSocketDisconnect:
        notif_manager.disconnect(websocket, usuario_id)

