# Especificación Funcional: 001 - Core de Ventas e Inventario FEFO

**Módulo:** 001-core-ventas-inventario  
**Nivel Organizacional:** Operativo (TPS / POS)  
**Estado:** DRAFT / LISTO PARA REVISIÓN  
**Dependencias:** Ninguna (Módulo Base)  

---

## 1. Declaración del Problema y Objetivos
Los comercios minoristas pierden margen por dos causas inmediatas: lentitud en la fila de cobro que causa abandono de compra, y pérdidas de mercancía perecedera por falta de rotación estricta de caducidades en el estante. 

Este módulo implementa el núcleo transaccional de Quantix:
* Búsqueda y escaneo ultra-rápido de productos (< 200 ms).
* Generación de tickets de venta con cálculo automático de totales e impuestos.
* Descarga de inventario basada estrictamente en la regla **FEFO** (*First Expired, First Out*).
* Congelamiento del costo unitario del lote despachado en cada línea de venta para trazabilidad de margen histórico.

---

## 2. Historias de Usuario y Criterios de Aceptación

### Historia 1: Venta de Alta Velocidad por Código de Barras
* **Como** cajero del punto de venta,  
* **Quiero** escanear el código de barras o ingresar el SKU de un producto,  
* **Para** agregarlo de inmediato al carrito de compra sin fricción ni retrasos.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Escaneo exitoso de un producto con stock
  Dado que existe un producto con código "7501001" y al menos un lote disponible
  Cuando el cajero envía "7501001" al endpoint del carrito
  Entonces el sistema responde en menos de 200 ms
  Y el artículo se agrega con su precio de venta unitario vigente.

Escenario: Producto sin stock disponible
  Dado que el producto "7501002" tiene cantidad_disponible = 0 en todos sus lotes
  Cuando el cajero intenta agregarlo
  Entonces el sistema rechaza la adición con código de error HTTP 409 (OUT_OF_STOCK)
  Y no se modifica el carrito.
```

---

### Historia 2: Descarga Automática bajo Regla FEFO
* **Como** administrador de tienda,  
* **Quiero** que el sistema descuente automáticamente las existencias del lote con vencimiento más próximo,  
* **Para** minimizar el riesgo de caducidad en estantería sin exigir decisiones manuales al cajero.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Venta descargando del lote con fecha de caducidad más cercana
  Dado un producto "LECHE-1L" con dos lotes:
    | Lote    | Vencimiento | Cantidad | Costo Unitario |
    | LOTE-A  | 2026-09-10  | 5        | 1.20           |
    | LOTE-B  | 2026-09-25  | 10       | 1.25           |
  Cuando el cajero procesa la venta de 3 unidades de "LECHE-1L"
  Entonces las 3 unidades se descuentan de "LOTE-A"
  Y el stock de "LOTE-A" queda en 2 unidades
  Y el costo registrado en el detalle de la venta es de 1.20 por unidad.

Escenario: Venta que agota un lote y continúa en el siguiente
  Dado el mismo producto con 2 unidades en "LOTE-A" y 10 en "LOTE-B"
  Cuando el cajero procesa la venta de 4 unidades
  Entonces se descargan 2 unidades de "LOTE-A" a costo 1.20
  Y 2 unidades de "LOTE-B" a costo 1.25
  Y se crean dos líneas de detalle asociadas a cada lote respectivo.
```

---

## 3. Requisitos No Funcionales del Módulo
* **Latencia de Escaneo:** $\le$ 200 ms en el 99% de las peticiones.
* **Latencia de Checkout (Finalizar Venta):** $\le$ 1,500 ms incluyendo rebaja de stock y generación de folio.
* **Aislamiento de Transacciones:** Nivel de aislamiento `READ COMMITTED` con bloqueo pesimista (`SELECT ... FOR UPDATE`) sobre los lotes de inventario durante el checkout para prevenir sobreventas concurrentes.
