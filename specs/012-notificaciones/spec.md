# Especificación Funcional: 012 - Notificaciones, Alertas Push y Sistema Unificado de Toasts

**Módulo:** 012-notificaciones  
**Nivel Organizacional:** Transversal (Comunicación y Telemetría en Tiempo Real)  
**Estado:** IMPLEMENTADO / VERIFICADO  
**Dependencias:** 001-core-ventas-inventario, 010-auth-usuarios  

---

## 1. Declaración del Problema y Objetivos
Los eventos críticos en un entorno de retail (descuadres de caja, alertas sanitarias de caducidad FEFO, stock bajo en bodega e incidencias de sincronización offline) exigen canales de alerta inmediata tanto para el personal en piso como para la supervisión directiva. Asimismo, el feedback de la interfaz debe ser claro, no intrusivo y coherente, evitando la proliferación de banners locales que desajusten el layout de la pantalla.

Este módulo implementa el subsistema integral de notificaciones de Quantix:
* **Canal Saliente de Correo Electrónico (SMTP Seguro):** Envío asíncrono de tickets digitales a clientes y alertas de descuadres de arqueo (> $50.00) a directores mediante `EmailSender` (`smtplib` sobre TLS puerto 587/465) configurado vía variables de entorno.
* **Canal Bidireccional WebSocket en Tiempo Real (`app/api/ws.py`):** Conexión segura `WS /api/v1/ws/notificaciones/stream?token=<JWT>` con despacho de mensajes personales, difusión masiva (*broadcast*) y wrappers síncronos thread-safe (`emit_alerta_sync`, `emit_evento_sync`) para hilos en background (APScheduler y worker de sincronización).
* **Sistema Unificado de Notificaciones Toast Flotante (`ToastContainer.tsx`):**
  - Montado como componente único global en `Layout.tsx` en la posición fija superior-derecha (`fixed top-20 right-6 z-50`).
  - Taxonomía semántica de 4 severidades con duraciones parametrizadas:
    - `CRITICO`: 8,000 ms, borde animado de alta visibilidad, reservado para descuadres graves y fallos críticos.
    - `WARNING`: 5,000 ms, estilo ámbar, para contingencias offline y cupones inválidos.
    - `SUCCESS`: 5,000 ms, estilo esmeralda, para ventas completadas, guardado de configuración y recepción de stock.
    - `INFO`: 5,000 ms, estilo azul/violeta, para eventos informativos.
  - Temporizador con barra de progreso decreciente, soporte de pausa interactiva al pasar el cursor (`onMouseEnter`), botón de descarte manual y soporte para botones de acción contextual.
* **Directriz de Cero Banners Locales:** Regla arquitectónica estricta que prohíbe el uso de banners fijos o inline en formularios y cabeceras que desplacen elementos de la UI. Todo feedback se canaliza a través de la función global `mostrarToast(...)`.
* **Centro de Notificaciones Persistente (`NotificationCenter.tsx`):** Drawer desplegable en el Header que almacena el historial cronológico de notificaciones recibidas con contador de no leídas y opciones para marcar como leídas o limpiar historial.

---

## 2. Arquitectura de Notificaciones Frontend

```mermaid
flowchart LR
    WS[WebSocket Server /ws/notificaciones] -->|Frame Push| Hook[useWebSocket.ts]
    Comp[Cualquier Componente React] -->|mostrarToast| Hook
    Hook -->|Dispatch| Store[useNotificationStore (Zustand)]
    Store -->|Renderiza Toasts| TC[ToastContainer.tsx (Top-20 Right-6)]
    Store -->|Almacena Historial| NC[NotificationCenter.tsx (Header Drawer)]
```

### Contrato del Helper `mostrarToast`
```typescript
mostrarToast({
  titulo: string;
  mensaje: string;
  severidad?: 'CRITICO' | 'WARNING' | 'SUCCESS' | 'INFO';
  duracionMs?: number;
  accion?: {
    etiqueta: string;
    onClick: () => void;
  };
});
```

---

## 3. Historias de Usuario y Criterios de Aceptación Verificados

### Historia 1: Recepción de Alerta Push en Tiempo Real por WebSocket
```gherkin
Escenario: Emisión de alerta de descuadre crítico
  Dado que un cajero cierra turno con un faltante de $85.00 (> $50.00)
  Cuando el backend procesa el arqueo
  Entonces el notif_manager emite un frame push WebSocket a los supervisores conectados
  Y el frontend recibe el frame y genera automáticamente un toast CRITICO de 8 segundos
  Y añade el evento al historial de NotificationCenter con contador de no leídas incrementado.
```

### Historia 2: Interacción y Pausa en Toast Flotante
```gherkin
Escenario: Pausa de temporizador de autodestrucción al hover
  Dado un toast visible en la esquina superior derecha con barra de progreso decreciente
  Cuando el usuario sitúa el puntero del ratón sobre el toast (onMouseEnter)
  Entonces la barra de progreso y el temporizador se detienen de inmediato
  Y al retirar el cursor (onMouseLeave) el temporizador se reanuda hasta completarse.
```

### Historia 3: Despacho Asíncrono de Correo Electrónico
```gherkin
Escenario: Envío de ticket digital al cliente tras checkout
  Dado un ticket completado en POS con email de cliente asociado
  Cuando el cajero finaliza la venta
  Entonces FastAPI encola la tarea en BackgroundTasks con EmailSender
  Y la respuesta HTTP 200 de la venta no se bloquea por la latencia SMTP
  Y el cliente recibe el correo con el desglose térmico en HTML y texto plano.
```

---

## 4. Requisitos No Funcionales del Módulo
* **Resiliencia de Conexión:** Reconexión automática exponencial del WebSocket ante cortes temporales de red.
* **Seguridad de Credenciales:** La contraseña de aplicación SMTP se gestiona exclusivamente por variables de entorno `.env` (`SMTP_PASSWORD`), sin exponerse jamás en bundles clientes.
* **Accesibilidad:** Anuncios con atributo ARIA `role="status"` y `aria-live="polite"` en `ToastContainer` para tecnologías de asistencia.
