# Especificación Funcional: 007 - Pagos Electrónicos, Pasarelas y Seguridad

**Módulo:** 007-pagos-seguridad  
**Nivel Organizacional:** Operativo (TPS)  
**Estado:** IMPLEMENTADO / VERIFICADO (Pasarela Determinista y Emulador de Terminales)  
**Dependencias:** 001-core-ventas-inventario, 006-caja-mermas-fraude  

---

## 1. Problema y Objetivos
La gestión de cobros electrónicos en punto de venta requiere una experiencia fluida para tarjetas bancarias y billeteras digitales, asegurando al mismo tiempo la prevención de cobros duplicados por fallos de red, el manejo de estados inciertos y una estricta política de contingencia ante caídas de conectividad.

Este módulo implementa la capa de pagos electrónicos y seguridad de Quantix:
* **Emulación de Hardware en Punto de Venta (`SimuladorPagoModal.tsx`):**
  - **Tarjeta Bancaria / Contactless:** Animación interactiva de ondas de proximidad NFC, lectura de chip y barra de progreso de 3 segundos ("Esperando proximidad...", "Leyendo chip...", "¡Pago Aprobado!").
  - **Billetera Digital QR DeUna (Banco Pichincha):** Generación algorítmica de matriz QR dinámica (SVG 25×25 con patrones de búsqueda y seed hashing del monto/fecha), temporizador de cuenta regresiva y confirmación de débito bancario.
* **Política Offline Estricta:** En modo sin conexión (`OFFLINE_LISTO` u `OFFLINE_NO_DISPONIBLE`), el POS deshabilita forzosamente los métodos de pago electrónico (Tarjeta, QR, Transferencia), restringiendo la operación exclusivamente a **EFECTIVO**.
* **Pasarela Determinista de Pagos:** Implementación en servidor (`SimulatedPaymentGateway`) con tokens controlados:
  - `SIM-APPROVED`: Autorización bancaria exitosa con referencia única.
  - `SIM-DECLINED`: Rechazo con código HTTP 402 Payment Required.
  - `SIM-TIMEOUT`: Falla de comunicación con código HTTP 504 Gateway Timeout y retención de estado `INCIERTO`.
* **Idempotencia y Trazabilidad:** Persistencia de transacciones en la tabla `intentos_pago` con restricción única sobre `(checkout_idempotency_key, indice)`.
* **Conciliación Supervisada:** Endpoint `POST /api/v1/pagos/intentos/{id}/conciliar` reservado para roles `SUPERVISOR` o `DIRECTOR`, registrando la resolución en la bitácora inmutable `auditoria_evento`.

---

## 2. Historias de Usuario y Criterios de Aceptación

### Historia 1: Cobro con Tarjeta Contactless o Billetera QR DeUna
* **Como** cajero del punto de venta,  
* **Quiero** seleccionar cobro con tarjeta o código QR y visualizar el emulador interactivo de terminal,  
* **Para** completar el cobro multimodal con confirmación visual sin necesidad de datáfonos físicos externos.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Cobro exitoso con Tarjeta Contactless
  Dado un carrito en POS con total a pagar de $15.50
  Cuando el cajero selecciona "TARJETA" y presiona "Procesar Cobro"
  Entonces se abre el SimuladorPagoModal en modo Contactless
  Y tras 3 segundos de lectura de chip la pasarela retorna SIM-APPROVED
  Y se emite el ticket de compra completada.

Escenario: Cobro exitoso con QR DeUna (Banco Pichincha)
  Dado un carrito con total a pagar de $8.00
  Cuando el cajero selecciona "QR" y procesa el cobro
  Entonces el sistema genera una matriz QR procedural dinámica en SVG
  Y simula la recepción de la transferencia interbancaria en tiempo real.
```

---

### Historia 2: Restricción Automática de Medios de Pago en Contingencia Offline
* **Como** encargado de tienda,  
* **Quiero** que el sistema bloquee automáticamente pagos con tarjeta y QR cuando no haya conexión a internet,  
* **Para** evitar emitir tickets electrónicos sin confirmación bancaria central.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Desconexión de red y forzado a cobro en efectivo
  Dado que la conectividad cambia a estado OFFLINE_LISTO
  Cuando el cajero visualiza el panel de cobro en el POS
  Entonces los botones "Tarjeta" y "QR DeUna" quedan deshabilitados visualmente
  Y el selector se fija exclusivamente en "Efectivo"
  Y si el usuario intenta enviar un pago electrónico el sistema responde con error 400.
```

---

### Historia 3: Conciliación de Timeout por Supervisor
* **Como** supervisor,  
* **Quiero** conciliar un pago electrónico que quedó en estado `INCIERTO` tras un timeout,  
* **Para** resolver la transacción bancaria y registrar la justificación en auditoría.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Conciliación manual de intento de pago
  Dado un intento_pago con estado INCIERTO originado por SIM-TIMEOUT
  Cuando el supervisor invoca POST /api/v1/pagos/intentos/{id}/conciliar con resolucion = "APROBADO" y nota justificada
  Entonces el intento pasa a estado APROBADO
  Y se registra un evento inmutable en auditoria_evento con tipo CONCILIACION_PAGO
  Y el autorizador queda vinculado al registro.
```

---

## 3. Requisitos No Funcionales del Módulo
* **Seguridad de Datos Sensibles:** El sistema no captura ni almacena números de tarjeta completos (PAN) ni códigos de seguridad (CVV); delega la referencia a tokens de pasarela.
* **Idempotencia Estricta:** Dos peticiones de cobro con la misma `idempotency_key` nunca generan múltiples cobros ni duplicidad en `intentos_pago`.
