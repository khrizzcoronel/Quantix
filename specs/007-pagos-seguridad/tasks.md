# Tareas de Implementación: 007 - Pagos y Seguridad de Transacciones

**Módulo:** 007-pagos-seguridad  
**Regla:** Las tareas deben completarse en estricto orden de dependencias. Cada tarea completada debe marcarse con `[x]` y contar con un test asociado.

---

## Bloque 1: Persistencia y Middleware (Pre-requisito para todo el módulo)
- [x] **TASK-007-SIM-01:** Integrar una pasarela simulada en el checkout con escenarios aprobado, rechazado y timeout, referencia determinista y rollback transaccional.
- [x] **TASK-007-SIM-02:** Hacer idempotente el checkout mediante `Venta.idempotency_key`, restricción única y migración Alembic.
- [x] **TASK-007-SIM-03:** Persistir intentos aprobados, rechazados e inciertos; bloquear reintentos ambiguos y permitir conciliación auditada por Supervisor/Director.
- [ ] **TASK-007-01:** Implementar endpoint `POST /api/v1/pagos/iniciar` — valida el `Idempotency-Key` del header, verifica duplicados en ventana de 60 segundos, llama a la pasarela y persiste el resultado en `pagos_venta`; devuelve URL de pago o token según el método.
- [ ] **TASK-007-02:** Implementar endpoint `POST /api/v1/pagos/webhook` — recibe confirmación asíncrona de la pasarela, valida firma HMAC del payload y actualiza `pagos_venta.estado_pago` a `CONFIRMADO` o `RECHAZADO`.
- [ ] **TASK-007-03:** Implementar `IdempotenciaMiddleware` — intercepta todas las solicitudes a `/api/v1/pagos/iniciar`; si el `Idempotency-Key` ya existe en base de datos, devuelve la respuesta cacheada sin re-llamar a la pasarela.

## Bloque 2: Servicios de Resiliencia
- [ ] **TASK-007-04:** Implementar `RetryBackoffService.ejecutar(fn, max_intentos=3)` — realiza hasta 3 llamadas a la pasarela con esperas de 1s, 2s y 4s entre intentos (backoff exponencial). Si todos los intentos fallan, registra `ERR-PAG-01` en `auditoria_eventos`.
- [ ] **TASK-007-05:** Implementar `DuplicadoDetectorService.verificar(idempotency_key)` — consulta `pagos_venta` por `idempotency_key` creado en los últimos 60 segundos; si existe, devuelve el error `ERR-PAG-02` sin invocar a la pasarela.

## Bloque 3: Frontend
- [ ] **TASK-007-06:** Crear componente React `SelectorMetodoPago.tsx` — muestra botones de método de pago con transiciones de estado: `IDLE → PROCESANDO → APROBADO | RECHAZADO`; desactiva opciones de tarjeta cuando la terminal está en modo offline (integración con 008-offline-sync).
