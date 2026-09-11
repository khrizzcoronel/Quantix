# Especificación Funcional: 002 - Clientes, Fidelización y Segmentación RFM

**Módulo:** 002-clientes-fidelizacion  
**Nivel Organizacional:** Táctico / Estratégico (MIS / EIS)  
**Estado:** IMPLEMENTADO / VERIFICADO  
**Dependencias:** 001-core-ventas-inventario  

---

## 1. Problema y Objetivos
La retención de clientes en el comercio minorista requiere mecanismos ágiles de identificación en caja que no demoren la atención, combinados con incentivos comerciales reales y segmentación analítica basada en comportamiento de compra efectivo.

Este módulo implementa el CRM integral de Quantix:
* Identificación y captura ultra-rápida de clientes en el punto de venta ($\le 200$ ms) mediante **Cédula / DNI** o **Teléfono celular**.
* Aislamiento estricto por sucursal: los clientes y cupones pertenecen a la sucursal de registro (`sucursal_id`). Los supervisores gestionan únicamente los clientes y cupones de su sede (`enforce_sucursal_scope`), mientras que Dirección General cuenta con visibilidad multi-sede consolidada.
* Programa de Fidelización por Puntos: acumulación automática en cada venta (1 punto por cada $10.00 en base gravable) y redención directa como descuento en caja (10 puntos acumulados = $1.00 de descuento).
* Emisión y validación territorial de cupones de descuento (`CUMPLEANIOS`, `REACTIVACION`, `COMBO`, `MANUAL`) con verificación de estado (`EMITIDO`, `CANJEADO`, `EXPIRADO`), vigencia temporal y compatibilidad de sucursal.
* Historial unificado de transacciones por cliente con acceso a los últimos 50 tickets emitidos.
* Segmentación analítica RFM (*Recency, Frequency, Monetary*) procesada dinámicamente sobre la capa DuckDB Gold con clasificación en 9 cuadrantes estratégicos.

---

## 2. Historias de Usuario y Criterios de Aceptación

### Historia 1: Identificación y Registro Ágil en Caja (Cédula o Teléfono)
* **Como** cajero del punto de venta,  
* **Quiero** buscar al cliente tecleando indistintamente su Cédula o su Teléfono,  
* **Para** asociarlo a la venta en menos de 2 segundos sin entorpecer la fila.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Búsqueda exitosa por Cédula o Teléfono
  Dado un cliente "Juan Pérez" con cedula "1712345678" y telefono "0991234567"
  Cuando el cajero envía "1712345678" o "0991234567" a GET /crm/clientes/buscar/{identificador}
  Entonces el sistema responde con los datos del cliente, saldo de puntos y sucursal de origen
  Y el tiempo de respuesta es inferior a 200 ms.

Escenario: Registro rápido de nuevo cliente desde el POS o CRM
  Dado que el cliente no existe en la base de datos
  Cuando el cajero o supervisor envía nombre, cedula única, telefono y la sucursal activa
  Entonces se crea el cliente con puntos_acumulados = 0 y activo = true
  Y queda disponible inmediatamente para asociar a la venta.
```

---

### Historia 2: Acumulación y Redención de Puntos de Lealtad
* **Como** cliente frecuente,  
* **Quiero** acumular puntos por mis compras y canjearlos por descuentos en caja,  
* **Para** obtener un beneficio tangible por mi preferencia.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Acumulación de puntos tras checkout
  Dado un cliente con 50 puntos acumulados
  Cuando completa una compra con base gravable de $42.50
  Entonces el sistema suma 4 puntos (1 punto por cada $10 completos)
  Y el saldo del cliente queda en 54 puntos.

Escenario: Redención de puntos en checkout
  Dado un cliente con 120 puntos acumulados
  Cuando solicita redimir 100 puntos en un ticket de $30.00
  Entonces el sistema descuenta $10.00 del total a pagar (10 puntos = $1.00)
  Y el saldo de puntos del cliente disminuye a 20 puntos.
```

---

### Historia 3: Emisión y Validación Territorial de Cupones
* **Como** supervisor de sucursal,  
* **Quiero** emitir cupones promocionales válidos exclusivamente en mi sede,  
* **Para** dinamizar las ventas locales sin riesgo de canjes no autorizados en otras tiendas.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Cupón emitido en Sucursal Norte validado en Sucursal Norte
  Dado un cupón "NORTE10" emitido para la Sucursal Norte con 10% de descuento y estado EMITIDO
  Cuando el cajero de Sucursal Norte aplica el cupón antes del checkout
  Entonces el sistema lo valida exitosamente y calcula el descuento.

Escenario: Intento de uso de cupón en sucursal ajena
  Dado el mismo cupón "NORTE10" perteneciente a Sucursal Norte
  Cuando un cajero intenta aplicarlo en la Sucursal Matriz
  Entonces el sistema rechaza el cupón con error HTTP 400 informando incompatibilidad territorial.

Escenario: Cupón ya canjeado o expirado
  Dado un cupón con estado CANJEADO o con valido_hasta < CURRENT_DATE
  Cuando se envía para validación
  Entonces el sistema devuelve HTTP 400 indicando que el cupón no es utilizable.
```

---

### Historia 4: Segmentación Dinámica RFM en DuckDB Gold
* **Como** director comercial,  
* **Quiero** visualizar la distribución analítica de clientes según su recencia, frecuencia y gasto acumulado,  
* **Para** dirigir campañas de reactivación y premiar a los compradores de mayor valor.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Consulta de segmentación RFM multi-sede o por sucursal
  Dado el conjunto de hechos gold.fact_ventas y dimensiones gold.dim_cliente en DuckDB
  Cuando el director solicita GET /api/v1/reportes/analisis/rfm-clientes
  Entonces el motor calcula los percentiles NTILE(5) de Recencia, Frecuencia y Monetario
  Y agrupa a los clientes en los 9 segmentos: CAMPEONES, LEALES, POTENCIALES, EN RIESGO, DORMIDOS, NUEVOS, PROMETEDORES, NECESITAN ATENCION y EN ESPERA
  Y devuelve el ticket promedio, volumen de compras y clientes únicos por segmento.
```

---

## 3. Requisitos No Funcionales del Módulo
* **Unicidad e Integridad:** Restricción `UNIQUE` obligatoria en `clientes.cedula` y `clientes.telefono`.
* **Aislamiento Multi-Tenant Lógico:** Filtro automático `sucursal_id == current_user.sucursal_id` en todas las consultas para roles no directivos.
* **Trazabilidad Inmutable:** Las bajas de clientes y cupones son lógicas (`activo = false`, `estado = EXPIRADO`) para preservar la integridad de ventas históricas.
