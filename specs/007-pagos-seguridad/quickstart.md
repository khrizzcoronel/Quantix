# Guía Rápida de Verificación: 007 - Pagos Electrónicos y Seguridad

**Módulo:** 007-pagos-seguridad  

---

## 1. Simulación de Pago con Tarjeta y Clave de Idempotencia

```bash
curl -X POST "http://localhost:8000/api/v1/pagos/iniciar" \
     -H "Content-Type: application/json" \
     -H "Idempotency-Key: TICKET-2026-0001-TARJETA" \
     -d '{
       "venta_id": "00000000-0000-0000-0000-000000000001",
       "metodo_pago": "TARJETA_DEBITO",
       "monto": 45.50,
       "token_pasarela": "tok_visa_dummy_test"
     }'
```

*Respuesta esperada (HTTP 200):*
```json
{
  "id": "11111111-1111-1111-1111-111111111111",
  "venta_id": "00000000-0000-0000-0000-000000000001",
  "estado_pago": "CONFIRMADO",
  "referencia_transaccion": "TX-998877",
  "autorizacion_bancaria": "AUTH-0123"
}
```

---

## 2. Verificación de Idempotencia (Reintento de Pago)
Al reenviar la misma solicitud con el mismo `Idempotency-Key` en menos de 60 segundos, el backend devuelve el mismo resultado previo sin duplicar el débito en la venta.
