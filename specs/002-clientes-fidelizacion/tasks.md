# Tareas de Implementación: 002 - Clientes, Segmentación RFM y Fidelización

**Módulo:** 002-clientes-fidelizacion  
**Regla:** Las tareas deben completarse en estricto orden de dependencias. Cada tarea completada debe marcarse con `[x]` y contar con un test asociado.

---

## Bloque 1: API de Clientes (Pre-requisito para POS y Analytics)
- [ ] **TASK-002-01:** Implementar endpoint `GET /api/v1/clientes/buscar?telefono=` — búsqueda exacta e insensible a mayúsculas por número de teléfono.
- [ ] **TASK-002-02:** Implementar endpoint `POST /api/v1/clientes/` — alta rápida con solo `telefono` y `nombre`; campos `email` y `fecha_nacimiento` opcionales.

## Bloque 2: Lógica de Dominio — Ciclo Intercompra
- [ ] **TASK-002-03:** Implementar función Python `calcular_ciclo_intercompra(cliente_id)` — calcula la media de intervalos en días entre compras consecutivas y persiste el resultado en `clientes.ciclo_intercompra_dias`.

## Bloque 3: Automatización de Cupones y Reactivación
- [ ] **TASK-002-04:** Implementar job APScheduler `generar_cupones_cumpleanos()` — corre a medianoche diariamente, busca clientes cuyo `fecha_nacimiento` cae en los próximos 7 días con `opt_in_marketing = TRUE` y emite cupones en la tabla `cupones`.
- [ ] **TASK-002-05:** Implementar lógica de reactivación antipánico — filtra clientes con segmento `CAMPEON` o `LEAL` cuyo `dias_sin_comprar > ciclo_intercompra_dias * multiplicador_rfm` (parámetro `rfm_multiplicador_reactivacion` de `CONFIGURACION`).

## Bloque 4: Endpoint POS — Canje de Cupón
- [ ] **TASK-002-06:** Implementar endpoint `POST /api/v1/pos/canjear-cupon` — valida vigencia, estado y aplica el descuento al carrito activo; actualiza `cupones.estado` a `CANJEADO` y registra `venta_canje_id`.

## Bloque 5: ETL Analítico
- [ ] **TASK-002-07:** Implementar ETL nocturno en DuckDB para `FACT_CLIENTE_RFM_PERIODO` — recalcula recency, frequency, monetary y segmento RFM para todos los clientes activos del periodo.

## Bloque 6: Frontend
- [ ] **TASK-002-08:** Crear componente React `ClienteSearchBar.tsx` — input de teléfono en POS con debounce de 300 ms; muestra nombre y segmento RFM del cliente encontrado.
- [ ] **TASK-002-09:** Crear componente React `ClientePerfilView.tsx` — ficha de cliente con historial de compras paginado, segmento RFM actual y cupones activos.
