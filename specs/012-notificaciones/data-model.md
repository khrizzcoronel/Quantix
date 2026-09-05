# Modelo de Datos: Notificaciones

Este módulo **no requiere la creación de nuevas tablas** exclusivas para almacenar las notificaciones, ya que su enfoque principal es el envío y tránsito de información.

## Registro de Errores y Auditoría

Cualquier fallo durante el proceso de envío de notificaciones (por ejemplo, errores de conexión SMTP, credenciales inválidas, rechazo del servidor de destino) o eventos importantes en los WebSockets se registrarán utilizando el sistema de auditoría existente.

*   **Tabla afectada:** `AUDITORIA_EVENTO`
*   **Campos relevantes:**
    *   `tipo_evento`: `ERROR_SMTP`, `WS_CONNECT`, `WS_DISCONNECT`, `WS_ERROR`.
    *   `detalles`: JSON con el mensaje de error o contexto de la conexión.
    *   `usuario_id`: El identificador del usuario que originó la acción (si aplica).
