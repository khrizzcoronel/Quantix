# Análisis de Cobertura de Requisitos (Gap Analysis) v5

**Actualizado:** 2026-09-09  
**Fuente de verdad:** código y pruebas presentes en el repositorio. La existencia de una especificación no se considera evidencia de implementación.

## Escala de estado

- **Implementado:** existe código productivo y una ruta o flujo utilizable.
- **Parcial:** existe una parte del flujo, pero falta algún criterio importante del SRS.
- **Pendiente:** solo existe documentación, un modelo aislado o una interfaz sin flujo operativo completo.

## Cobertura funcional

| Requisito | Estado | Evidencia y brecha actual |
| :--- | :--- | :--- |
| RF-POS-01 Búsqueda y cobro rápido | Implementado | Catálogo y búsqueda vía API. El objetivo de 200 ms aún necesita prueba de rendimiento. |
| RF-POS-02 Cobro multimodal | Parcial | Efectivo, pagos divididos y pasarela simulada determinista con intentos persistentes y conciliación. No existe integración bancaria o datáfono real. |
| RF-POS-03 Identificación del cliente | Implementado | Asociación opcional por teléfono desde POS y CRM. |
| RF-POS-04 Offline-first | Implementado | Modo degradado en POS: cobro exclusivo en efectivo, catálogo local en IndexedDB (`quantix_offline_db`), emisión de comprobante offline explícito con ID local (sin folio fiscal falso) y persistencia durable ante recargas de navegador o desconexión. |
| RF-POS-05 Comprobantes | Parcial | Ticket visual/imprimible implementado. Envío automático por correo/SMS pendiente. |
| RF-POS-06 Usuarios y sesión | Implementado | Login JWT, roles, apertura, recuperación de sesión real y arqueo. |
| RF-INV-01 Trazabilidad por lote | Implementado | Lotes con código, costo, cantidad y vencimiento; recepción desde órdenes de compra. |
| RF-INV-02 FEFO | Implementado | Bloqueo pesimista, orden por vencimiento y exclusión de lotes vencidos o agotados. |
| RF-INV-03 Alertas de caducidad | Implementado | Endpoint de alertas y notificaciones periódicas. |
| RF-INV-04 Punto de reorden | Parcial | Existen sugerencias de compra; falta validar el modelo contra demanda y lead time reales. |
| RF-INV-05 Sobre-inventario | Parcial | Job predictivo básico; falta la política completa de capital inmovilizado. |
| RF-PRC-01 Clasificación estratégica | Parcial | El modelo actual usa clasificación ABC; no representa completamente GANCHO/NICHO/REGULAR. |
| RF-PRC-02 Margen en tiempo real | Implementado | Costo del lote y margen quedan congelados por detalle de venta. |
| RF-PRC-03 Protección de margen | Parcial | Hay campos y validaciones promocionales; falta cerrar alertas ante nuevas compras. |
| RF-PRC-04 Promociones cruzadas | Implementado | CRUD y motor de combos/volumen/monto con protección de margen. |
| RF-CRM-01 Perfil unificado | Parcial | CRUD e historial disponibles; cumpleaños y preferencias de contacto no están completos en el modelo. |
| RF-CRM-02 Cumpleaños | Pendiente | No existe flujo completo de emisión y envío automático. |
| RF-CRM-03 Ciclo intercompra | Pendiente | No existe cálculo productivo completo por cliente. |
| RF-CRM-04 Reactivación | Parcial | Job por inactividad fija; aún no usa 150% del ciclo individual. |
| RF-CRM-05 RFM/LTV | Implementado | Segmentación analítica RFM calculada sobre DuckDB Gold en `GET /api/v1/reportes/analisis/rfm-clientes` y visualizada en tarjetas interactivas de `Analisis.tsx`. |
| RF-SEG-01 Arqueo ciego | Implementado | El backend calcula el teórico después de recibir el conteo físico. |
| RF-SEG-02 Discrepancias | Implementado | Tolerancia, auditoría y alertas WebSocket. |
| RF-SEG-03 Autorización supervisada | Implementado | Override protegido por JWT, validación de rol y auditoría del autorizador. |
| RF-SEG-04 Registro inmutable | Parcial | La API no expone edición/borrado; falta una protección append-only a nivel PostgreSQL. |
| RF-BI-01 Tablero táctico | Implementado | Vista operativa en `Tactico.tsx` con auditoría en vivo, arqueos y transferencias. |
| RF-BI-02 Margen vs. rotación | Implementado | Matriz Pareto ABC en `GET /api/v1/reportes/analisis/abc-productos` y visualización en `Analisis.tsx`. |
| RF-BI-03 LTV | Implementado | Gasto acumulado y ticket medio analítico en segmentación RFM. |
| RF-BI-04 Proyección de demanda | Implementado | Inferencia estadística con Teorema del Límite Central (Normal Z / Student-t) e intervalos de confianza al 95%. |
| RF-REP-01/12 Reportes Avanzados | Implementado | Módulo 012 completo: Constructor dinámico de reportes OLAP, 15 columnas configurables, filtros, agrupaciones, totales consolidados, plantillas persistentes y exportación a CSV/PDF. |

## Requisitos no funcionales

| Requisito | Estado | Observación |
| :--- | :--- | :--- |
| RNF-PERF-01/02 | Sin certificar | No hay pruebas automáticas de latencia de búsqueda o checkout. |
| RNF-PERF-03 | Sin certificar | No hay benchmark con un millón de registros. |
| RNF-DISP-01/02 | Implementado | Arquitectura offline-first completa: IndexedDB nativo (`quantix_offline_db` v1 con stores `catalogo`, `ventas`, `cola_sync`, `metadata`), snapshot configurable con TTL (24h), cola FIFO transaccional con Web Locks API (`quantix_sync_lock`), tolerancia a desconexión con histéresis anti-oscilación (2 fallos = offline, 2 éxitos = online), asignación FEFO en servidor sin stock negativo (`PENDIENTE_REVISION` + `IncidenciaSync`) y supervisión auditada de incidencias. |
| RNF-SEG-01 | Implementado | bcrypt y JWT; los secretos se inyectan por entorno. |
| RNF-SEG-02 | Implementado para simulación | La pasarela simulada no recibe ni almacena PAN/CVV. |
| RNF-SEG-03 | Implementado | REST y WebSocket requieren JWT; frontend bloquea navegación directa según rol con `RoleRoute`. |
| RNF-ESC-01 | Implementado | PostgreSQL y DuckDB están desacoplados por ETL Medallion (Bronze/Silver/Gold). |
| RNF-ESC-02 | Implementado | Multi-sucursal activo en base de datos (`sucursales`, `transferencias_stock`), selector en frontend y aislamiento estricto de consultas por rol (Supervisor fijo, Director global). |

## Calidad verificada

- **95 pruebas automáticas aprobadas en backend** (`pytest`), 0 regresiones.
- **32 pruebas automáticas aprobadas en frontend** (`vitest`).
- **Compilación TypeScript y Vite exitosa** (`tsc -b && vite build`) con 0 errores.
- Rutas frontend protegidas por rol (`DIRECTOR`, `SUPERVISOR`, `BODEGUERO`, `CAJERO`).
- Migraciones Alembic verificadas hasta la versión `0010_add_plantillas_reporte.py`.
- DuckDB Gold actualizado con dimensiones `dim_cliente`, `dim_cajero`, `dim_sucursal`, `dim_producto` y hechos `fact_ventas`, `fact_pagos`.
- Aislamiento RBAC verificado: supervisores restringidos obligatoriamente a su sucursal asignada.
