# Guía Rápida de Verificación (Quickstart): 005 - Promociones Inteligentes

**Módulo:** 005-promociones-inteligentes  
**Objetivo:** Verificar en menos de 3 minutos que el motor de combos aplica descuentos correctamente y que la liquidación FEFO activa precios de oferta.

---

## 1. Crear una Regla de Combo (Supervisor/Director)

```bash
curl -X POST "http://localhost:8000/api/v1/admin/promociones/reglas/" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <token-supervisor>" \
     -d '{
       "nombre": "Combo Leche + Cereal 15% OFF",
       "producto_trigger_id":  "00000000-0000-0000-0000-000000000001",
       "producto_objetivo_id": "00000000-0000-0000-0000-000000000002",
       "descuento_valor": 15.0,
       "descuento_tipo": "PORCENTAJE",
       "valido_desde": "2026-09-01"
     }'
```
*Respuesta esperada (HTTP 201):* JSON con `id` de la regla creada y ambos productos referenciados.

---

## 2. Probar el Combo en el Checkout

```bash
curl -X POST "http://localhost:8000/api/v1/pos/checkout" \
     -H "Content-Type: application/json" \
     -d '{
       "items": [
         {"producto_id": "00000000-0000-0000-0000-000000000001", "cantidad": 1},
         {"producto_id": "00000000-0000-0000-0000-000000000002", "cantidad": 1}
       ]
     }'
```
*Resultado esperado:* El `detalle_ventas` del producto objetivo debe mostrar `descuento_unitario` equivalente al 15 % de su precio.

---

## 3. Probar Liquidación FEFO

```sql
-- Insertar un lote con vencimiento en los próximos 5 días para disparar la liquidación
INSERT INTO lotes_inventario (producto_id, numero_lote, fecha_vencimiento, costo_unitario_compra, cantidad_inicial, cantidad_disponible)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'LOTE-CADUCIDAD-PROXIMA',
  CURRENT_DATE + 5,
  40.00,
  20,
  20
);
```

Ejecutar el job manualmente o esperar el ciclo horario, luego verificar:

```bash
# El precio del producto debe mostrar el descuento de liquidación activo
curl -X GET "http://localhost:8000/api/v1/pos/buscar-producto?q=00000000-0000-0000-0000-000000000003" \
     -H "Accept: application/json"
```
*Resultado esperado:* El campo `precio_venta` refleja el descuento FEFO; debe haber un registro en `AUDITORIA_EVENTO` con tipo `LIQUIDACION_FEFO`.

---

## 4. Probar Rechazo por Margen Negativo

```sql
-- Elevar artificialmente el costo del lote para forzar margen negativo con el combo
UPDATE lotes_inventario SET costo_unitario_compra = 999.00
WHERE numero_lote = 'LOTE-TEST';
```

```bash
# Intentar el checkout: debe rechazarse con ERR-PRO-01
curl -X POST "http://localhost:8000/api/v1/pos/checkout" \
     -H "Content-Type: application/json" \
     -d '{"items": [{"producto_id": "...", "cantidad": 1}, {"producto_id": "...", "cantidad": 1}]}'
```
*Respuesta esperada (HTTP 422):* Body con código de error `ERR-PRO-01` y descripción del margen negativo calculado.
