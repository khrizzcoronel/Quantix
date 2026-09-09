# Especificación Funcional: 012 - Notificaciones y Alertas

**Módulo:** 012-notificaciones  

## 1. Objetivo
Gestionar toda la comunicación de salida del sistema Quantix. Este módulo debe emitir correos electrónicos (ej. envío de tickets a clientes) utilizando el protocolo SMTP con autenticación segura, y enviar notificaciones en tiempo real a las aplicaciones conectadas.

## 2. Configuración SMTP Requerida
El sistema utilizará una cuenta conectada por SMTP utilizando una App Password generada.
**Credencial de acceso:** `[VALOR_OCULTO_EN_.ENV]` (Nota: en la implementación de código, esto se inyectará siempre mediante variables de entorno `.env`, **NUNCA** hardcodeado en el código fuente).

## 3. Notificaciones en Tiempo Real
Para cumplir con los avisos inmediatos en la caja o la bodega (ej. Alerta de Stock Bajo, Autorización concedida), se utilizará un gestor de conexiones WebSockets (`FastAPI WebSockets`).

## 4. Tareas a Ejecutar
- [x] **TASK-012-01:** Implementar clase `EmailSender` (basada en `smtplib` / `email.message`) configurada con puerto 587/465, leyendo host, correo y la app password (`SMTP_PASSWORD`) desde `.env`.
- [ ] **TASK-012-02:** Implementar worker asíncrono en FastAPI (`BackgroundTasks`) para enviar el ticket digital al cliente tras una compra sin detener la respuesta HTTP.
- [x] **TASK-012-03:** Implementar gestor de WebSockets en `WS /ws/notificaciones/stream?token=<JWT>`. El usuario se deriva del token firmado y debe permanecer activo.
