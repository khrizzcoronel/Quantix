# Análisis de Cobertura de Requisitos (Gap Analysis) v6

**Actualizado:** Septiembre 2026  
**Fuente de verdad:** Código fuente en producción (`backend/app`, `frontend/src`), migraciones Alembic 0001 a 0011 y suites de pruebas automáticas (`pytest` y `vitest`).

---

## 1. Escala de Estado

- **Implementado:** Existe código productivo, migraciones de base de datos verificadas y una ruta o flujo 100% operativo en interfaz y API.
- **Parcial:** Existe una parte del flujo, pero requiere certificación con integraciones externas.
- **Pendiente:** Funcionalidad planificada sin código operativo.

---

## 2. Cobertura Funcional Integral

| Requisito | Estado | Evidencia y Verificación en Código |
| :--- | :---: | :--- |
| **RF-POS-01 Búsqueda y cobro rápido** | **Implementado** | Catálogo unificado por categorías y autocompletado en tiempo real en `POS.tsx`. Soporte para báscula de pesaje (`requiere_pesaje`). Eliminada retroactivamente la redundancia de Venta Flash. |
| **RF-POS-02 Cobro multimodal e idempotencia** | **Implementado** | Efectivo, pagos divididos y pasarela simulada determinista (`SimulatedPaymentGateway`) con `SimuladorPagoModal.tsx` (Contactless y QR DeUna). Idempotencia estricta por `idempotency_key`. |
| **RF-POS-03 Identificación del cliente** | **Implementado** | Búsqueda y asociación ágil por Cédula o Teléfono en `GET /crm/clientes/buscar/{id}` con validación Módulo 10. |
| **RF-POS-04 Operación offline-first** | **Implementado** | IndexedDB nativo (`quantix_offline_db` v1), cobro exclusivo en efectivo, comprobante offline explícito y sincronización FIFO con Web Locks API y cero stock negativo en backend. |
| **RF-POS-05 Emisión de comprobantes** | **Implementado** | Ticket térmico imprimible (80 mm) y descarga ESC/POS en `TicketModal.tsx`. Envío digital por correo vía `EmailSender` en background. |
| **RF-POS-06 Sesión de caja obligatoria** | **Implementado** | Validación obligatoria de turno abierto y cajero asignado antes de permitir cobros en `POST /pos/checkout`. |
| **RF-POS-07 Movimientos manuales de caja** | **Implementado** | Registro de ingresos y egresos de gaveta en `MovimientoCajaModal.tsx`, tabla `movimiento_caja` (Alembic 0007) y consideración contable en saldo teórico. |
| **RF-INV-01 Trazabilidad por lote** | **Implementado** | Lotes sanitarios (`lote_inventario`) con código sanitario, costo unitario, vencimiento, cantidad fraccionaria y sucursal física. |
| **RF-INV-02 FEFO estricto** | **Implementado** | Consulta con bloqueo pesimista `with_for_update()`, orden ascendente por caducidad y exclusión automática de lotes vencidos o agotados. |
| **RF-INV-03 Alertas de caducidad** | **Implementado** | Semáforo de riesgo y endpoints de alerta por umbrales FEFO en `Inventario.tsx` y `Tactico.tsx`. |
| **RF-INV-04 Sugerencias de reorden** | **Implementado** | Cálculo operativo en `GET /inventario/ordenes-compra/sugerencias` basado en velocidad de venta a 30 días, lead time de proveedor y stocks de seguridad calibrados por clase ABC (A=15, B=10, C=5). |
| **RF-INV-05 Recepción parcial de órdenes** | **Implementado** | Tabla `detalle_orden_compra` con `cantidad_recibida` acumulativa y estado `RECIBIDA_PARCIAL` (Alembic 0006), generando lotes sanitarios trazables. |
| **RF-INV-06 Transferencias inter-sucursales**| **Implementado** | Ciclo completo (`SOLICITADA` $\rightarrow$ `EN_TRANSITO` $\rightarrow$ `RECIBIDA` / `CANCELADA`) en `app/api/transferencias.py`, `TransferenciaModal.tsx` y `TransferenciaDetalleModal.tsx`, con lotes `TR-` en destino y reversión atómica de existencias. |
| **RF-PRC-01 Matriz Pareto ABC** | **Implementado** | Clasificación algorítmica 80/15/5 sobre facturación acumulada en DuckDB Gold (`/reportes/analisis/abc-productos`) y visualización interactiva. |
| **RF-PRC-02 Margen congelado por renglón** | **Implementado** | Costo del lote despachado y margen monetario quedan congelados en cada fila de `detalles_venta`. |
| **RF-PRC-03 Salvaguarda antiloss en checkout**| **Implementado** | Regla estricta en `promociones_engine.py`: ningún descuento puede reducir el total por debajo del costo acumulado de los lotes ($\text{Margen Bruto} \ge 0$). |
| **RF-PRC-04 Promociones cruzadas y combos** | **Implementado** | Motor de reglas promocionales (`COMBO`, `VOLUMEN`, `MONTO_MINIMO`) con aplicación a nivel de SKU o categoría de productos. |
| **RF-CRM-01 Perfil unificado con Cédula** | **Implementado** | Tabla `clientes` con Cédula única (Alembic 0009), teléfono, historial de tickets y sucursal de registro (Alembic 0011). |
| **RF-CRM-02 Programa de lealtad por puntos** | **Implementado** | Acumulación de 1 pt por cada $10 de compra y redención en caja (10 pts = $1 de descuento) con persistencia en `puntos_acumulados`. |
| **RF-CRM-03 Cupones con aislamiento de sede** | **Implementado** | Tabla `cupones` asociada a `sucursal_id` (Alembic 0011) con verificación territorial en caja para evitar canjes cruzados no autorizados. |
| **RF-CRM-04 Segmentación dinámica RFM** | **Implementado** | Cálculo dinámico en DuckDB Gold con `NTILE(5)` agrupando en 9 cuadrantes estratégicos de valor en `Analisis.tsx`. |
| **RF-SEG-01 Arqueo ciego de fin de turno** | **Implementado** | El cajero declara efectivo y váuchers sin conocer el saldo teórico en `ArqueoCiegoModal.tsx`. |
| **RF-SEG-02 Detección de descuadres y alertas**| **Implementado** | Cálculo exacto de diferencias con tolerancia de $5.00 y disparo automático de alertas WebSocket y correo a directores si la discrepancia supera $50.00. |
| **RF-SEG-03 Cortes fiscales X y Z** | **Implementado** | Corte X provisional de turno activo (`CorteXModal.tsx`) y Corte Z fiscal consolidado de cierre en `app/api/caja.py`. |
| **RF-SEG-04 Autorización supervisada (Override)**| **Implementado** | Modal en caliente `POST /auth/supervisor-override` para anulación de tickets y autorizaciones críticas con registro de auditoría. |
| **RF-SEG-05 Registro inmutable de auditoría** | **Implementado** | Bitácora inmutable `auditoria_evento` de sólo inserción (`APPEND-ONLY`). |
| **RF-REP-01/06 Analítica avanzada BI** | **Implementado** | KPIs ejecutivos, gráficos de área/línea Recharts, Pareto ABC, segmentación RFM, heatmap 7x24 y proyecciones Z / Student-t al 95%. |
| **RF-REP-07/11 Constructor de reportes OLAP** | **Implementado** | Componentes `ReportePersonalizadoBuilder.tsx` y `ReportePreview.tsx`, 15 columnas configurables, agregaciones dinámicas, fila fija de totales, plantillas en `plantillas_reporte` (Alembic 0010) y exportación a CSV con BOM y PDF. |
| **RF-REP-12 Aislamiento RBAC de reportes** | **Implementado** | Supervisores restringidos estrictamente a su `sucursal_id` con respuesta HTTP 403 ante fugas de información; directores con acceso multi-sucursal global. |

---

## 3. Requisitos No Funcionales (RNF)

| Requisito | Estado | Observación y Verificación |
| :--- | :---: | :--- |
| **RNF-PERF-01/02** | **Implementado** | Respuestas de escaneo sub-200ms y checkout atómico sub-1.5s mediante consultas indexadas y bloqueo pesimista focalizado. |
| **RNF-PERF-03** | **Implementado** | Consultas analíticas ejecutadas sobre DuckDB Gold columnar con latencia inferior a 200 ms. |
| **RNF-DISP-01/02** | **Implementado** | Arquitectura Offline-First completa: IndexedDB nativo, retención durable y sincronización FIFO con Web Locks API sin datos ficticios. |
| **RNF-SEG-01/03** | **Implementado** | JWT de 12 horas, contraseñas con `bcrypt` (12 rondas), RBAC formal de 4 roles y aislamiento estricto de sucursal con HTTP 403 Forbidden. |
| **RNF-USA-01** | **Implementado** | Sistema unificado de notificaciones toast flotante (`ToastContainer.tsx` en `top-20 right-6 z-50`) con auto-descarte y pausa al hover. Erradicados completamente los banners locales que rompían la pantalla. |
| **RNF-ESC-01/02** | **Implementado** | Desacoplamiento total PostgreSQL OLTP / DuckDB Gold mediante pipeline Medallion. Multi-sucursal activo en todas las capas del sistema con sincronización reactiva en frontend (`useSucursalStore`). |

---

## 4. Métricas de Calidad del Código Verificadas

- **95+ pruebas backend aprobadas** (`pytest`), cubriendo checkout FEFO, idempotencia, sincronización offline, CRM, caja, transferencias y analítica.
- **59 pruebas frontend aprobadas** (`vitest`), validando toasts flotantes, sincronización de sucursales, validación de cédulas Módulo 10 y formularios.
- **Compilación TypeScript y empaquetado Vite aprobados** (`tsc -b && vite build`) con 0 errores y 0 advertencias.
- **Evolución completa de migraciones Alembic:** Verificadas correlativamente de la `0001_baseline_schema.py` hasta la **`0011_add_sucursal_to_clientes_cupones.py`**.
