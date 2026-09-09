# Análisis de Cobertura de Requisitos (Gap Analysis) v4

**Actualizado:** 2026-09-08  
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
| RF-POS-04 Offline-first | Pendiente | Ante fallo se conserva el carrito; aún no existe IndexedDB, cola FIFO o sincronización de ventas. |
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
| RF-CRM-05 RFM/LTV | Pendiente | El modelo Gold extendido y el tablero aún no están implementados. |
| RF-SEG-01 Arqueo ciego | Implementado | El backend calcula el teórico después de recibir el conteo físico. |
| RF-SEG-02 Discrepancias | Implementado | Tolerancia, auditoría y alertas WebSocket. |
| RF-SEG-03 Autorización supervisada | Implementado | Override protegido por JWT, validación de rol y auditoría del autorizador. |
| RF-SEG-04 Registro inmutable | Parcial | La API no expone edición/borrado; falta una protección append-only a nivel PostgreSQL. |
| RF-BI-01 Tablero táctico | Parcial | Vista operativa con datos PostgreSQL; no todas las métricas proceden de Gold. |
| RF-BI-02 Margen vs. rotación | Pendiente | No existe matriz productiva completa. |
| RF-BI-03 LTV | Pendiente | No existe hecho RFM/LTV completo. |
| RF-BI-04 Proyección de demanda | Parcial | Endpoint Z/T real y frontend conectado; falta incluir días cero y excluir quiebres de stock. |

## Requisitos no funcionales

| Requisito | Estado | Observación |
| :--- | :--- | :--- |
| RNF-PERF-01/02 | Sin certificar | No hay pruebas automáticas de latencia de búsqueda o checkout. |
| RNF-PERF-03 | Sin certificar | No hay benchmark con un millón de registros. |
| RNF-DISP-01/02 | Pendiente | Offline-first y recuperación local siguen pendientes. |
| RNF-SEG-01 | Implementado | bcrypt y JWT; los secretos se inyectan por entorno. |
| RNF-SEG-02 | Implementado para simulación | La pasarela simulada no recibe ni almacena PAN/CVV. |
| RNF-SEG-03 | Implementado básico | REST y WebSocket requieren JWT; el frontend bloquea también la navegación directa según rol. |
| RNF-ESC-01 | Implementado básico | PostgreSQL y DuckDB están desacoplados por ETL programado. |
| RNF-ESC-02 | Pendiente | Multi-sucursal permanece solo en especificación. |

## Calidad verificada

- 68 pruebas automáticas aprobadas en la ejecución conjunta.
- Build TypeScript/Vite y lint frontend aprobados sin advertencias.
- Rutas frontend protegidas por rol y módulos cargados bajo demanda.
- Migraciones Alembic verificadas mediante `upgrade → downgrade → upgrade` sobre una base vacía.
- El frontend no contiene datos mock de negocio, comprobantes contables locales inventados ni convierte errores de API en operaciones exitosas.

## Próximas prioridades

1. Offline-first con IndexedDB, idempotencia y resolución de conflictos.
2. Adaptador de proveedor real, webhooks firmados y conciliación bancaria.
3. Gold dimensional completo, RFM/LTV y tableros restantes.
4. Multi-sucursal y aislamiento obligatorio de consultas.
5. Pruebas E2E, rendimiento y CI.
