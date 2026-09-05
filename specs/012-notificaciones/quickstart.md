# Quickstart: Pruebas de Notificaciones

## Pruebas de WebSockets

Para probar las conexiones WebSocket y verificar la recepción de notificaciones en tiempo real, puedes utilizar la herramienta de línea de comandos `wscat`.

### Comando de prueba

Para conectarte al gestor de notificaciones de un usuario específico (ej. `usuario_id = 1`):

```bash
wscat -c ws://localhost:8000/api/v1/ws/notificaciones/1
```

Una vez conectado, podrás observar los mensajes JSON enviados por el servidor en respuesta a eventos del sistema, como alertas de bajo stock o autorizaciones.
