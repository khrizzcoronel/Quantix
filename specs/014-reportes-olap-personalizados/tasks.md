# Checklist de Tareas: 014 - Constructor de Reportes y Motor OLAP

- [x] Crear migración Alembic `0010_add_plantillas_reporte.py`.
- [x] Crear modelo relacional `PlantillaReporte` en `app/models/reportes.py`.
- [x] Diseñar e implementar catálogo de 15 columnas OLAP en `app/api/reportes.py`.
- [x] Implementar constructor dinámico de consultas agregadas sobre DuckDB Gold.
- [x] Implementar cálculo en servidor de la fila fija de totales consolidados.
- [x] Desarrollar endpoints CRUD para gestión de plantillas públicas y privadas.
- [x] Desarrollar componente `ReportePersonalizadoBuilder.tsx` con controles de orden y filtros.
- [x] Desarrollar componente `ReportePreview.tsx` con paginación local y tabla destacada.
- [x] Desarrollar utilidades de exportación a CSV (BOM UTF-8) y PDF formal con membrete.
- [x] Integrar control de aislamiento RBAC para restringir reportes de supervisores a su sede.
- [x] Validar suite de pruebas unitarias y de integración del módulo de reportes.
