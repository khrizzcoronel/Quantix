# Especificación Funcional: 007 - Pagos Electrónicos, Pasarelas y Seguridad

**Módulo:** 007-pagos-seguridad  
**Nivel Organizacional:** Operativo (TPS)  
**Estado:** PARCIAL — simulación local disponible; integración bancaria pendiente  
**Dependencias:** 001-core-ventas-inventario, 006-caja-mermas-fraude  

---

## 1. Problema y Objetivos
Los datáfonos obsoletos y la falta de soporte para pagos digitales derivan en clonación de tarjetas, fraude y pérdida de ventas frente a la competencia moderna.

El código actual implementa una **pasarela simulada y determinista** dentro de
`POST /api/v1/pos/checkout`. Permite validar el flujo funcional sin afirmar una
integración bancaria ni cumplimiento PCI que todavía no existen.

Escenarios soportados mediante `referencia_pasarela`:

- `SIM-APPROVED`: autoriza y genera una referencia estable.
- `SIM-DECLINED`: responde HTTP 402 y revierte la transacción.
- `SIM-TIMEOUT`: responde HTTP 504 y revierte la transacción.

El checkout usa `idempotency_key` para devolver la venta ya creada cuando se
repite una solicitud. Cada pago electrónico persiste un intento con estado
`INICIADO`, `APROBADO`, `RECHAZADO`, `INCIERTO` o `VINCULADO`. Un timeout queda
bloqueado hasta que un supervisor o director lo concilia mediante
`POST /api/v1/pagos/intentos/{id}/conciliar`; el estado puede consultarse con
`GET /api/v1/pagos/intentos/{idempotency_key}`. La conciliación genera auditoría.

Webhooks firmados, reintentos contra un proveedor real, tokenización PCI y
terminales/contactless permanecen pendientes.
