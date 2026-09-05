# Checklist de Requisitos: 001 - Core de Ventas e Inventario

**Módulo:** 001-core-ventas-inventario  
**Referencia SRS:** [especificacion_requisitos.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/requisitos/especificacion_requisitos.md)

---

## Requisitos Funcionales Asociados
- [ ] **RF-POS-01 (Búsqueda y Cobro Rápido):** Tiempo de respuesta < 200 ms verificado con benchmark.
- [ ] **RF-POS-04 (Operación Offline-First):** El carrito no se bloquea si la conexión cae.
- [ ] **RF-INV-01 (Trazabilidad por Lote y Vencimiento):** Campo `fecha_vencimiento` y `costo_unitario_compra` validados como obligatorios en la API.
- [ ] **RF-INV-02 (Asignación Automática FEFO):** Descuento exacto del lote con fecha más próxima validado por tests unitarios.
- [ ] **RF-PRC-02 (Cálculo del Margen en Tiempo Real):** El campo `margen_linea` en `detalle_ventas` se calcula como `precio_unitario_cobrado - costo_unitario_lote`.

## Criterios de Calidad y No Funcionales
- [ ] **RNF-PERF-01:** Búsqueda en < 200 ms confirmada.
- [ ] **RNF-PERF-02:** Checkout en < 1.5 s confirmado.
- [ ] **Tipado Estricto:** Cero `Any` en esquemas Pydantic y tipado estricto en SQLAlchemy 2.0.
