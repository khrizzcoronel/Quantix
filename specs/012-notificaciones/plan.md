# Plan de Implementación: Notificaciones y Alertas

## Arquitectura de Componentes

1.  **EmailSender (SMTP)**
    *   Clase responsable de la conexión SMTP usando `smtplib` y `email.message`.
    *   Soportará conexiones seguras mediante TLS (puerto 587) o SSL (puerto 465).
    *   Obtendrá las credenciales (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`) mediante inyección de variables de entorno, asegurando que ninguna credencial quede en el código fuente.

2.  **Workers Asíncronos (BackgroundTasks)**
    *   Integración con `FastAPI BackgroundTasks` para delegar el envío de correos (ej. tickets digitales) a un proceso en segundo plano.
    *   Garantiza que la respuesta HTTP al cliente sea inmediata sin esperar la resolución del servidor SMTP.

3.  **WebSocketManager**
    *   Gestor de conexiones en tiempo real para notificaciones inmediatas (ej. bajo stock, autorizaciones).
    *   Manejará las conexiones activas por `usuario_id`, permitiendo el envío dirigido (unicast) o masivo (broadcast).
    *   Implementará rutinas de conexión, desconexión y ping/pong para mantener vivas las conexiones.
