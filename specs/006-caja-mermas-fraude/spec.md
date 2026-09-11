# Especificación Funcional: 006 - Control de Caja, Mermas, Arqueo Ciego y Prevención de Fraude

**Módulo:** 006-caja-mermas-fraude  
**Nivel Organizacional:** Operativo / Táctico (TPS / MIS)  
**Estado:** IMPLEMENTADO / VERIFICADO  
**Dependencias:** 001-core-ventas-inventario  

---

## 1. Problema y Objetivos
Las pérdidas en piso de venta provocadas por descuadres de caja, robos hormiga y aperturas no autorizadas erosionan significativamente el margen neto del comercio minorista. Los arqueos tradicionales donde el cajero conoce el saldo esperado facilitan el encubrimiento de diferencias.

Este módulo implementa el protocolo de control de efectivo y auditoría inmutable de Quantix:
* **Gestión de Turnos y Apertura:** Registro obligatorio del fondo inicial de gaveta (`monto_inicial_efectivo`) y terminal asignada al abrir sesión de caja.
* **Movimientos Manuales Extraordinarios de Caja (`movimiento_caja`):** Registro justificado de dotaciones de cambio (`INGRESO`) y gastos menores o sangrías de seguridad a caja fuerte (`EGRESO`), validando que haya efectivo disponible en gaveta antes de permitir egresos.
* **Arqueo Ciego de Fin de Turno:** Al concluir el turno, el cajero declara el desglose físico de billetes y monedas sin que la pantalla revele el saldo teórico esperado por el sistema.
* **Fórmula de Conciliación Matemática:** El sistema calcula el saldo teórico exacto en el servidor tras recibir la declaración física:
  $$\text{Saldo Teórico} = \text{Fondo Inicial} + \text{Ventas Efectivo} + \text{Ingresos Manuales} - \text{Egresos Manuales}$$
* **Control de Tolerancias y Alertas:**
  - Tolerancia operativa: \$5.00. Diferencias superiores marcan la sesión como `DESCUADRE` (`FALTANTE` o `SOBRANTE`).
  - Alerta crítica: Descuadres superiores a \$50.00 disparan inmediatamente una notificación push por WebSocket a supervisores y un correo electrónico automatizado a los directores (`EmailSender`).
* **Cortes Fiscales Operativos:**
  - **Corte X:** Pre-corte de caja en cualquier momento del turno sin interrumpir la sesión (`GET /caja/corte-x`).
  - **Corte Z:** Cierre fiscal formal con folios primero/último, tickets anulados, desglose de ventas por método de pago y resultado del arqueo ciego (`GET /caja/sesiones/{id}/corte-z`).
* **Indicadores de Desempeño y Tasa de Precisión de Gaveta:** Monitoreo histórico por cajero con cálculo de la **Tasa de Precisión de Gaveta** (`precision_gaveta_pct`).
* **Bitácora Inmutable de Auditoría:** Registro `APPEND-ONLY` (`auditoria_evento`) de anulaciones, overrides de supervisor, diferencias de arqueo y aperturas sin venta.

---

## 2. Historias de Usuario y Criterios de Aceptación

### Historia 1: Movimiento Manual de Efectivo (Ingreso / Egreso)
* **Como** cajero o supervisor en turno,  
* **Quiero** registrar una entrada de cambio o una salida justificada de efectivo de la gaveta,  
* **Para** mantener cuadrado el balance teórico de la caja durante el día.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Registro de ingreso de cambio a gaveta
  Dado una sesión de caja "SES-01" en estado ABIERTA
  Cuando el cajero registra un INGRESO por $50.00 con concepto "Dotación de cambio en monedas"
  Entonces se inserta un registro en movimiento_caja con tipo INGRESO
  Y el saldo teórico de efectivo de la sesión se incrementa en $50.00.

Escenario: Intento de egreso por monto superior al disponible en efectivo
  Dado que la gaveta cuenta actualmente con $30.00 de saldo acumulado
  Cuando el cajero intenta registrar un EGRESO por $50.00 para gastos de limpieza
  Entonces el sistema rechaza la operación con error HTTP 400 por fondos insuficientes en gaveta.
```

---

### Historia 2: Arqueo Ciego y Detección de Descuadres
* **Como** cajero,  
* **Quiero** declarar el conteo de billetes y monedas al terminar mi turno sin ver el total del sistema,  
* **Para** cerrar la caja de forma transparente y objetiva.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Cierre de caja cuadrado dentro de tolerancia
  Dado un saldo teórico de $320.00 en la sesión
  Cuando el cajero envía su declaración física por $322.00 (diferencia +$2.00 <= $5.00)
  Entonces el sistema registra arqueo_caja con estado OK
  Y la sesión pasa a estado CERRADA.

Escenario: Descuadre con disparo de alerta crítica
  Dado un saldo teórico de $500.00 en la sesión
  Cuando el cajero declara físicamente $420.00 (faltante de -$80.00 > $50.00)
  Entonces la sesión se marca en estado DESCUADRE con FALTANTE de -$80.00
  Y se emite una alerta WebSocket de severidad CRITICA
  Y se despacha un correo electrónico automático a los Directores Generales
  Y queda registrado en auditoria_evento.
```

---

### Historia 3: Cortes X y Z
* **Como** supervisor de tienda,  
* **Quiero** consultar un Corte X durante el turno para supervisar el flujo de efectivo y emitir el Corte Z al cierre,  
* **Para** controlar la recaudación por método de pago y folios fiscales emitidos.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Emisión de Corte X parcial
  Dado una sesión abierta con $200 de ventas en efectivo, $150 en tarjeta y $50 de ingresos manuales
  Cuando se solicita GET /api/v1/caja/corte-x
  Entonces devuelve el balance instantáneo de gaveta sin cerrar la sesión ni bloquear cobros.

Escenario: Emisión de Corte Z definitivo
  Dado una sesión cerrada con su arqueo completado
  Cuando se solicita GET /api/v1/caja/sesiones/{id}/corte-z
  Entonces genera el resumen fiscal con primer ticket, último ticket, tickets anulados, desglose total de medios de pago y resultado del arqueo.
```

---

## 3. Requisitos No Funcionales del Módulo
* **Inmutabilidad de Auditoría:** La tabla `auditoria_evento` no cuenta con endpoints de actualización (`PUT`) ni borrado (`DELETE`).
* **Aislamiento Multi-Sucursal:** Todas las sesiones de caja, arqueos y movimientos pertenecen a una `sucursal_id`. Los supervisores solo pueden auditar cajas de su propia sede.
