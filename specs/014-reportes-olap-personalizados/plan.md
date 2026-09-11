# Plan de Implementación: 014 - Constructor Dinámico de Reportes y Motor OLAP

## Fases de Implementación

### Fase 1: Capa de Base de Datos y Persistencia
- [x] Migración Alembic `0010_add_plantillas_reporte.py` creando la tabla `plantillas_reporte`.
- [x] Modelo SQLAlchemy `PlantillaReporte` en `app/models/reportes.py`.
- [x] Definición de esquemas Pydantic `PlantillaReporteCreate`, `PlantillaReporteResponse` y `GenerarReporteRequest`.

### Fase 2: Motor Analítico sobre DuckDB Gold
- [x] Endpoint `GET /api/v1/reportes/columnas-disponibles` con el catálogo oficial de 15 columnas OLAP.
- [x] Endpoint `POST /api/v1/reportes/generar` con construcción dinámica de consultas SQL agregadas sobre `gold.fact_ventas`.
- [x] Cálculo de fila fija de totales consolidados (cantidades, subtotales, descuentos, impuestos, total facturado y margen).
- [x] CRUD de plantillas de reporte (`GET /plantillas`, `POST /plantillas`, `DELETE /plantillas/{id}`).

### Fase 3: Componentes de Interfaz de Usuario
- [x] Creación de `ReportePersonalizadoBuilder.tsx`: panel interactivo para selección y orden de columnas, filtros cruzados, selector de agrupación y modal para guardar plantilla.
- [x] Creación de `ReportePreview.tsx`: tabla paginada con fila fija de totales, ordenamiento por cabecera y controles de exportación.
- [x] Integración de utilidades de exportación `exportUtils.ts` (CSV con BOM UTF-8 y vista imprimible/PDF).
- [x] Integración en la vista principal `Analisis.tsx` con sincronización reactiva al cambiar de sucursal.

### Fase 4: Seguridad y Aislamiento RBAC
- [x] Aplicación de `enforce_sucursal_scope` para acotar los reportes generados por supervisores exclusivamente a su sede física.
- [x] Permisos de plantillas públicas (visibles para toda la organización) y privadas (solo autor).
