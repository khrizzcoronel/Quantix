# Especificación Funcional: 003 - Precios, Rentabilidad, Matriz Pareto ABC y Órdenes de Compra

**Módulo:** 003-precios-margenes  
**Nivel Organizacional:** Táctico / Estratégico (MIS / EIS)  
**Estado:** IMPLEMENTADO / VERIFICADO  
**Dependencias:** 001-core-ventas-inventario  

---

## 1. Problema y Objetivos
En el comercio minorista, fijar precios sin un control riguroso del costo de adquisición y del impacto del mix de productos suele provocar erosión silenciosa de la rentabilidad o ventas por debajo del costo real.

Este módulo implementa el control de rentabilidad y abastecimiento de Quantix:
* Clasificación de catálogo basada en la **Matriz de Pareto ABC (80-15-5)** calculada dinámicamente sobre la facturación histórica acumulada en DuckDB Gold.
* Gestión completa de proveedores con tiempos de entrega pactados (`lead_time_dias`) para abastecimiento inteligente.
* Ciclo de vida de Órdenes de Compra con soporte nativo para **recepciones parciales** (`PENDIENTE`, `RECIBIDA_PARCIAL`, `RECIBIDA`, `CANCELADA`).
* Generación automática de lotes sanitarios con código estándar (`SAN-YYYYMMDD-XXXXXX`) y fecha de caducidad física al recepcionar mercancía de proveedores.
* Salvaguarda estricta de margen en checkout: ninguna combinación de promociones o cupones puede reducir el precio de venta final por debajo del costo acumulado de los lotes despachados ($\text{Margen Bruto} \ge 0$).
* Monitoreo directivo del margen bruto congelado a nivel de línea en cada transacción comercial.

---

## 2. Historias de Usuario y Criterios de Aceptación

### Historia 1: Clasificación de Catálogo mediante Pareto ABC
* **Como** director general o gerente comercial,  
* **Quiero** que el sistema clasifique automáticamente los productos en clases A, B y C según su contribución a los ingresos brutos,  
* **Para** enfocar los esfuerzos de negociación con proveedores y evitar quiebres en los artículos de mayor facturación.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Cálculo de la curva de Pareto ABC en DuckDB Gold
  Dado el histórico de ventas facturadas en gold.fact_ventas
  Cuando se consulta el reporte analítico GET /api/v1/reportes/analisis/abc-productos
  Entonces el sistema ordena los productos de mayor a menor facturación acumulada
  Y asigna "A" al primer 80% del valor total facturado
  Y asigna "B" al siguiente 15% (80% al 95%)
  Y asigna "C" al 5% restante
  Y devuelve el porcentaje acumulado, unidades vendidas y margen porcentual de cada SKU.
```

---

### Historia 2: Gestión de Órdenes de Compra y Recepción Parcial
* **Como** encargado de bodega o supervisor,  
* **Quiero** emitir órdenes de compra a proveedores y registrar entregas parciales cuando no surten el pedido completo,  
* **Para** actualizar el stock disponible de forma escalonada sin perder el control de los pendientes.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Recepción parcial de orden de compra
  Dado una orden de compra "OC-100" con 100 unidades solicitadas de "LECHE-1L" a $1.10 cada una
  Cuando el proveedor entrega un primer lote de 40 unidades con vencimiento 2026-11-30
  Entonces el sistema registra cantidad_recibida = 40.00 en detalle_orden_compra
  Y cambia el estado de la orden a RECIBIDA_PARCIAL
  Y genera un nuevo lote_inventario con codigo_lote autogenerado "SAN-...", cantidad = 40.00 y fecha_vencimiento = 2026-11-30
  Y el stock vendible en la sucursal se incrementa inmediatamente en 40 unidades.

Escenario: Liquidación total de orden de compra
  Dado la orden en estado RECIBIDA_PARCIAL con 60 unidades pendientes
  Cuando el proveedor entrega las 60 unidades restantes
  Entonces cantidad_recibida alcanza el 100% de lo solicitado
  Y el estado de la orden pasa a RECIBIDA con fecha_recepcion registrada.
```

---

### Historia 3: Salvaguarda Antiloss en Motor de Checkout
* **Como** auditor financiero,  
* **Quiero** que el motor de promociones y descuentos impida transacciones por debajo del costo unitario del lote,  
* **Para** garantizar que la tienda nunca venda a pérdida neta.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Descuento recortado automáticamente al umbral de costo
  Dado un carrito cuyo subtotal es $100.00 y el costo de reposición de los lotes es $65.00
  Y el cliente presenta un cupón o descuento por combo que pretendía aplicar $45.00 de rebaja
  Cuando el motor evalúa_promociones_carrito() en el checkout
  Entonces el descuento máximo permitido se acota estrictamente a $35.00 ($100 - $65)
  Y el total a pagar queda en $65.00 preservando margen_ganancia >= 0.
```

---

## 3. Requisitos No Funcionales del Módulo
* **Trazabilidad Sanitaria:** Todo lote creado a partir de una orden de compra debe portar un identificador trazable único (`SAN-YYYYMMDD-XXXXXX`), su fecha de caducidad física y la clave foránea a `orden_compra_id`.
* **Lead Time Configurable:** Cada proveedor mantiene su plazo medio de entrega en días (`lead_time_dias`), utilizado por el motor de reabastecimiento para sugerencias de compra.
