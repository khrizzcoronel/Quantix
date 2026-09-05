# Tareas de Desarrollo: Notificaciones

Las siguientes tareas deben completarse para la implementación del módulo:

- [ ] **TASK-012-01:** Implementar la clase `EmailSender` basada en `smtplib` y `email.message`. Configurar la conexión segura (puerto 587/465) y leer todas las credenciales (`SMTP_PASSWORD`, host, usuario) exclusivamente desde `.env`.
- [ ] **TASK-012-02:** Desarrollar un worker asíncrono utilizando `FastAPI BackgroundTasks` que permita enviar correos electrónicos (como el ticket digital tras una venta) sin bloquear la respuesta de la API.
- [ ] **TASK-012-03:** Crear la clase `WebSocketManager` e implementar el endpoint `GET /api/v1/ws/notificaciones/{usuario_id}` para empujar eventos en tiempo real a los clientes conectados.
