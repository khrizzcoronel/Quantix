# Especificación Funcional: 001 - Core de Ventas e Inventario FEFO

**Módulo:** 001-core-ventas-inventario  
**Nivel Organizacional:** Operativo (TPS / POS)  
**Estado:** IMPLEMENTADO / VERIFICADO  
**Dependencias:** Ninguna (Módulo Base)  

---

## 1. Declaración del Problema y Objetivos
Los comercios minoristas pierden margen por dos causas inmediatas: lentitud en la fila de cobro que causa abandono de compra, y pérdidas de mercancía perecedera por falta de rotación estricta de caducidades en el estante. 

Este módulo implementa el núcleo transaccional de Quantix:
* Búsqueda y escaneo ultra-rápido de productos ($\le 200$ ms) por código de barras, SKU o autocompletado en catálogo unificado.
* Soporte nativo para artículos de venta unitaria y artículos a granel que requieren pesaje en báscula (`requiere_pesaje`).
* Gestión obligatoria de turnos de caja: todo cobro requiere una sesión abierta y asignada al cajero autenticado (`sesion_caja_id`).
* Descarga de inventario basada estrictamente en la regla **FEFO** (*First Expired, First Out*), excluyendo automáticamente lotes caducados o agotados y bloqueando concurrentemente el lote mediante bloqueo pesimista (`SELECT ... FOR UPDATE`).
* Aislamiento por sucursal: la venta y la descarga FEFO se realizan exclusivamente sobre los lotes asignados a la sucursal activa (`sucursal_id`).
* Registro congelado del costo unitario del lote despachado en cada renglón de venta (`detalles_venta.margen_ganancia`) para trazabilidad histórica.
* Cobro multimodal integrado con soporte para pagos divididos (*split payment*), redención de puntos de lealtad y validación de cupones.
* Idempotencia estricta en checkout (`idempotency_key`) para prevenir cobros dobles.
* Anulación atómica de tickets con reversión de existencias al lote de origen y reactivación de estado.
* Emisión asíncrona de ticket digital por correo electrónico (`EmailSender`).

---

## 2. Historias de Usuario y Criterios de Aceptación

### Historia 1: Venta de Alta Velocidad por Catálogo Unificado y Báscula
* **Como** cajero del punto de venta,  
* **Quiero** escanear el código de barras, teclear el SKU o buscar interactivamente un producto,  
* **Para** agregarlo de inmediato al carrito de compra con validación automática de stock y pesaje.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Escaneo exitoso de un producto regular con stock
  Dado que existe un producto "7501001" con clasificación ABC "A" y al menos un lote activo en la sucursal
  Cuando el cajero envía "7501001" al endpoint del POS
  Entonces el sistema responde en menos de 200 ms
  Y el artículo se agrega al carrito con su precio unitario vigente.

Escenario: Producto con requerimiento de báscula / pesaje a granel
  Dado que el producto "MANZANA-KG" tiene marcado requiere_pesaje = true
  Cuando el cajero ingresa 1.450 kg capturados desde la balanza
  Entonces el sistema calcula el subtotal proporcional (1.450 * precio_kg)
  Y permite agregar la línea con cantidad decimal fraccionaria Numeric(10,3).

Escenario: Producto sin stock o con lotes caducados
  Dado que el producto "7501002" tiene cantidad_disponible = 0 o sus lotes tienen fecha_vencimiento < CURRENT_DATE
  Cuando el cajero intenta agregarlo
  Entonces el sistema rechaza la adición con error HTTP 409 (OUT_OF_STOCK)
  Y el carrito permanece intacto.
```

---

### Historia 2: Descarga Automática FEFO con Bloqueo Pesimista
* **Como** supervisor de tienda,  
* **Quiero** que el sistema descuente automáticamente las existencias del lote activo no vencido con caducidad más cercana en la sucursal,  
* **Para** erradicar mermas en piso de venta sin depender del criterio del cajero.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Venta descargando del lote con fecha de caducidad más próxima
  Dado un producto "LECHE-1L" en la sucursal actual con dos lotes:
    | Lote    | Vencimiento | Cantidad | Costo Unitario | Estado |
    | LOTE-A  | 2026-09-15  | 5.00     | 1.20           | ACTIVO |
    | LOTE-B  | 2026-09-30  | 10.00    | 1.25           | ACTIVO |
  Cuando el cajero finaliza una venta de 3 unidades de "LECHE-1L"
  Entonces las 3 unidades se descuentan de "LOTE-A"
  Y el stock de "LOTE-A" queda en 2.00
  Y la línea de detalle registra lote_id = LOTE-A, costo_unitario = 1.20 y margen congelado.

Escenario: Venta que agota un lote y continúa en el siguiente lote FEFO
  Dado el mismo producto con 2 unidades en "LOTE-A" y 10 en "LOTE-B"
  Cuando el cajero procesa una venta de 4 unidades
  Entonces se descargan 2 unidades de "LOTE-A" (quedando en 0 y estado AGOTADO)
  Y 2 unidades de "LOTE-B" (quedando en 8.00)
  Y se crean dos registros en detalles_venta preservando el costo específico de cada lote.

Escenario: Lote vencido excluido de la venta
  Dado un lote "LOTE-CADUCADO" con fecha_vencimiento = 2026-09-01 (fecha pasada)
  Cuando se procesa el checkout
  Entonces el sistema ignora dicho lote y no descuenta existencias de él bajo ninguna circunstancia.
```

---

### Historia 3: Idempotencia y Desglose Multimodal en Checkout
* **Como** cajero,  
* **Quiero** procesar cobros combinando efectivo, tarjeta bancaria, QR y cupones,  
* **Para** satisfacer la modalidad de pago del cliente garantizando que no se dupliquen transacciones.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Cobro multimodal exitoso con sesión activa
  Dado que el cajero tiene la sesión "SES-01" en estado ABIERTA
  Y el total a pagar del ticket es $25.00
  Cuando se envía el checkout con $15.00 en EFECTIVO y $10.00 en TARJETA
  Entonces el sistema registra ambos registros en pagos_venta vinculados a la venta
  Y la venta queda en estado COMPLETADA.

Escenario: Reintento de checkout con la misma clave de idempotencia
  Dado que se completó exitosamente la venta con idempotency_key = "abc-123"
  Cuando la red se interrumpe y el terminal reenvía la petición con la misma clave "abc-123"
  Entonces el sistema retorna inmediatamente la venta ya creada sin duplicar cargos ni restar doble stock.
```

---

### Historia 4: Anulación Atómica de Tickets
* **Como** supervisor,  
* **Quiero** anular una venta errónea o devolución en el mismo turno,  
* **Para** revertir el stock de forma atómica a los lotes originales y registrar la auditoría.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Anulación de ticket por supervisor
  Dado un ticket "TICK-001" en estado COMPLETADA con 2 unidades descargadas del LOTE-A
  Cuando el supervisor ejecuta la anulación con un motivo justificado
  Entonces la venta pasa a estado ANULADA
  Y las 2 unidades se reintegran inmediatamente a LOTE-A
  Y se genera un evento inmutable en auditoria_evento
  Y se emite una notificación WebSocket en tiempo real.
```

---

## 3. Requisitos No Funcionales del Módulo
* **Latencia de Escaneo / Búsqueda:** $\le 200$ ms en el percentil 95 (P95).
* **Latencia de Checkout:** $\le 1,500$ ms incluyendo validación de promociones, descarga FEFO, inserción de pagos y generación de comprobante.
* **Aislamiento de Transacciones:** Nivel de aislamiento transaccional con bloqueo pesimista (`SELECT ... FOR UPDATE`) sobre la tabla `lote_inventario` durante la asignación FEFO para evitar condiciones de carrera entre múltiples cajas.
* **Precisión Numérica:** Cantidades manejadas en `Numeric(10, 3)` para soportar tres decimales de gramaje; montos monetarios en `Numeric(10, 2)` con redondeo contable bancario (`ROUND_HALF_UP`).
