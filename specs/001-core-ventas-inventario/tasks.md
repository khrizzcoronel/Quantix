# Tareas de Implementación: 001 - Core de Ventas e Inventario

**Módulo:** 001-core-ventas-inventario  
**Regla:** Las tareas deben completarse en estricto orden de dependencias. Cada tarea completada debe marcarse con `[x]` y contar con un test asociado.

---

## Bloque 1: Base de Datos & Modelos ORM (Pre-requisito para todo)
- [ ] **TASK-001-01:** Crear modelos SQLAlchemy en `backend/app/models/` (`Producto`, `Categoria`, `LoteInventario`, `Venta`, `DetalleVenta`).
- [ ] **TASK-001-02:** Configurar índices de búsqueda por código de barras, SKU y orden FEFO (`producto_id`, `fecha_vencimiento`).
- [ ] **TASK-001-03:** Crear script de seed data con 10 productos (categorías variadas, tipos GANCHO y NICHO) y 20 lotes con fechas escalonadas.

## Bloque 2: Lógica de Dominio & Servicios
- [ ] **TASK-001-04:** Implementar algoritmo unitario `descontar_fefo(lotes, cantidad_pedida)` y validar con tests unitarios en pytest.
- [ ] **TASK-001-05:** Implementar `CheckoutService.procesar_venta()` con cálculo de márgenes y manejo de bloqueos `with_for_update()`.
- [ ] **TASK-001-06:** Test de integración: Simular intento de sobreventa simultánea de stock y verificar bloqueo de concurrencia.

## Bloque 3: Endpoints API FastAPI
- [ ] **TASK-001-07:** Implementar endpoint `GET /api/v1/pos/buscar-producto`.
- [ ] **TASK-001-08:** Implementar endpoint `POST /api/v1/pos/checkout`.
- [ ] **TASK-001-09:** Implementar endpoint `POST /api/v1/inventario/lotes`.
- [ ] **TASK-001-10:** Validar respuestas y códigos HTTP contra el contrato `contracts/api.yaml`.

## Bloque 4: Frontend POS (React + Vite)
- [ ] **TASK-001-11:** Crear componente `POSView.tsx` con input de escaneo enfocado permanentemente.
- [ ] **TASK-001-12:** Crear tabla de carrito con atajos de teclado (`+`, `-`, `Supr`).
- [ ] **TASK-001-13:** Modal de finalización de compra con resumen de total y botón de cobro rápido.
