# Especificación Funcional: 008 - Operación Offline-First y Sincronización

**Módulo:** 008-offline-sync  
**Nivel Organizacional:** Operativo (TPS / POS)  
**Estado:** DRAFT / LISTO PARA IMPLEMENTACIÓN  
**Dependencias:** 001-core-ventas-inventario, 007-pagos-seguridad  

---

## 1. Declaración del Problema y Objetivos
En el comercio físico minorista, un corte de suministro de internet no puede detener la fila de cobro. Si el sistema se bloquea cuando no hay conectividad, el cliente abandona la compra y la pérdida es inmediata.

Este módulo implementa:
* **Modo degradado de contingencia:** Detección automática de desconexión y habilitación instantánea de cobro en efectivo con almacenamiento local.
* **Cola de sincronización FIFO:** Envío automático de las transacciones almacenadas localmente hacia el backend central cuando se restablece la red.
* **Resolución de conflictos de stock:** Reglas deterministas para procesar ventas offline cuando el inventario central fluctuó durante la desconexión.

---

## 2. Historias de Usuario y Criterios de Aceptación

### Historia 1: Cobro Continuo durante Corte de Red
* **Como** cajero del punto de venta,  
* **Quiero** seguir registrando ventas y cobrando en efectivo cuando cae internet,  
* **Para** no detener el servicio ni perder ventas.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Caída de red y activación de modo degradado
  Dado que el terminal POS pierde conectividad con el servidor central
  Cuando el cajero intenta iniciar una venta
  Entonces la interfaz muestra un banner ámbar indicando "MODO OFFLINE"
  Y deshabilita las opciones de pago con tarjeta y QR
  Y permite cobrar exclusivamente en EFECTIVO usando la caché local de productos.

Escenario: Registro de venta offline con persistencia local
  Dado que el terminal está en modo offline
  Cuando el cajero finaliza una venta en efectivo
  Entonces se almacena en la base de datos local SQLite con estado "PENDIENTE_SYNC"
  Y se emite el ticket físico impreso con la leyenda "COMPROBANTE OFFLINE".
```

---

### Historia 2: Sincronización Automática y Resolución de Conflictos
* **Como** administrador de tienda,  
* **Quiero** que las ventas offline se sincronicen solas al volver la conexión,  
* **Para** mantener el inventario y los balances de caja centralizados sin intervención manual.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Sincronización limpia sin conflicto de stock
  Dado que hay 3 ventas almacenadas en la cola offline
  Y hay stock suficiente en los lotes del servidor central
  Cuando se restablece la conexión a internet
  Entonces las 3 ventas se envían en orden cronológico (FIFO) al servidor
  Y el servidor las registra descargando inventario FEFO
  Y la terminal marca las ventas locales como "SINCRONIZADAS".

Escenario: Conflicto por stock agotado durante desconexión
  Dado que se vendió 1 unidad offline del producto "P-100"
  Y durante el corte de red esa misma unidad fue vendida por otra caja online
  Cuando la venta offline intenta sincronizarse
  Entonces el servidor registra la venta pero marca el movimiento como "PENDIENTE_REVISION"
  Y notifica al Supervisor para ajuste administrativo de merma/inventario (ERR-SYNC-01).
```
