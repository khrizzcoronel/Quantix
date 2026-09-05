# Tareas de Implementación: 004 - Pronóstico de Demanda y Reposición

**Módulo:** 004-pronostico-demanda  
**Regla:** Las tareas deben completarse en estricto orden de dependencias. Cada tarea completada debe marcarse con `[x]` y contar con un test asociado.

---

## Bloque 1: ETL Analítico (Pre-requisito para todo el módulo)
- [ ] **TASK-004-01:** Implementar ETL nocturno en DuckDB para `FACT_INVENTARIO_DIARIO` — calcula stock de apertura, unidades vendidas, unidades recibidas y stock de cierre por SKU por día; marca `cantidad_rotura_stock > 0` en días con `stock_disponible = 0`.

## Bloque 2: Lógica de Dominio — Velocidad y Reorden
- [ ] **TASK-004-02:** Implementar función SQL/Python `calcular_velocidad_venta_diaria(producto_id, dias=30)` — promedio de `unidades_vendidas` sobre los días del periodo donde `cantidad_rotura_stock = 0`. Incluir tests unitarios en pytest con fixtures de datos sintéticos.
- [ ] **TASK-004-03:** Implementar función Python `calcular_punto_reorden(producto_id, proveedor_id)` — aplica la fórmula `(velocidad_diaria × lead_time_dias) + (velocidad_diaria × desviacion_estandar × factor_seguridad)`, leyendo `stock_seguridad_factor` de `CONFIGURACION`.

## Bloque 3: Endpoints API
- [ ] **TASK-004-04:** Implementar endpoint `GET /api/v1/admin/inventario/sugerencias-reposicion` — devuelve productos cuyo `stock_disponible_total <= punto_reorden`, con cantidad sugerida de compra y proveedor recomendado.
- [ ] **TASK-004-05:** Implementar endpoint `GET /api/v1/admin/inventario/sobrestock` — devuelve productos cuyo `dias_inventario_proyectados > inventario_dias_sobrestock` (parámetro de `CONFIGURACION`).

## Bloque 4: Frontend
- [ ] **TASK-004-06:** Crear componente React `TablaSugerenciasReposicion.tsx` — tabla con columnas: SKU, nombre, stock actual, punto de reorden, cantidad sugerida, proveedor preferido y botón `Generar Orden` que pre-llena el formulario de orden de compra.
