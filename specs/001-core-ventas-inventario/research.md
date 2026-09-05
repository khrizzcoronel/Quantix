# Investigación y Decisiones Técnicas: 001 - Core de Ventas e Inventario

**Módulo:** 001-core-ventas-inventario  

---

## 1. Algoritmo de Asignación FEFO (*First Expired, First Out*)

### Problema:
¿Cómo asignar los lotes de manera óptima cuando la cantidad solicitada de un artículo supera la existencia del lote más próximo a vencer?

### Opciones evaluadas:
1. **Asignación en tiempo real en Base de Datos (PostgreSQL Window Functions + CTE):**
   * *Ventaja:* 1 sola consulta SQL.
   * *Desventaja:* Difícil de simular en tests unitarios sin levantar base de datos completa.
2. **Asignación en capa de Dominio (Python / SQLAlchemy):**
   * *Ventaja:* Código altamente comprobable con pytest, desacoplado y fácil de depurar con mocks.
   * *Decisión:* **Opción 2 seleccionada.** El servicio consulta los lotes activos con `SELECT ... FOR UPDATE` ordenados por `fecha_vencimiento ASC` y el algoritmo en Python divide el pedido en fragmentos por lote, actualizando las cantidades disponibles.

---

## 2. Estrategia de Concurrencia para Evitar Sobrevientas (Stockouts)

### Problema:
Dos cajas registran simultáneamente la última unidad disponible del mismo lote.

### Solución adoptada:
* Uso de bloqueo pesimista `with_for_update()` en SQLAlchemy sobre las filas de `lotes_inventario` correspondientes al producto durante la transacción del checkout.
* La transacción dura < 50 ms, asegurando que no se generen deadlocks ni cuellos de botella notables.

---

## 3. Manejo de Redondeos y Dinero
* **Prohibido:** Usar tipos flotantes (`float`) en Python o `REAL/FLOAT` en PostgreSQL.
* **Estándar:** Uso estricto de `Decimal` en Python y `NUMERIC(10, 2)` en PostgreSQL para evitar errores de coma flotante en cálculos de impuestos y márgenes.
