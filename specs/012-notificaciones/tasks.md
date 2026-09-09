# Tareas de Desarrollo: Notificaciones

Las siguientes tareas deben completarse para la implementación del módulo:

- [x] **TASK-012-01:** Implementar la clase `EmailSender` basada en `smtplib` y `email.message`. Configurar la conexión segura (puerto 587/465) y leer todas las credenciales (`SMTP_PASSWORD`, host, usuario) exclusivamente desde `.env`.
- [ ] **TASK-012-02:** Desarrollar un worker asíncrono utilizando `FastAPI BackgroundTasks` que permita enviar correos electrónicos (como el ticket digital tras una venta) sin bloquear la respuesta de la API.
- [x] **TASK-012-03:** Crear `ConnectionManager` y el endpoint autenticado `WS /ws/notificaciones/stream?token=<JWT>` para eventos en tiempo real. El usuario se deriva del token, no de la URL.
