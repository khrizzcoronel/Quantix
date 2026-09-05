# Guía Rápida de Verificación (Quickstart): 003 - Precios y Márgenes

**Módulo:** 003-precios-margenes  
**Objetivo:** Verificar en menos de 3 minutos que la alerta de erosión de margen se activa correctamente y que la matriz de visualización devuelve datos.

---

## 1. Verificación de Alerta de Erosión de Margen

Registrar una orden de compra con un costo que supera el umbral del margen mínimo:

```bash
curl -X POST "http://localhost:8000/api/v1/inventario/ordenes-compra" \
     -H "Content-Type: application/json" \
     -d '{
       "proveedor_id": "00000000-0000-0000-0000-000000000010",
       "items": [
         {
           "producto_id": "00000000-0000-0000-0000-000000000001",
           "cantidad_solicitada": 50,
           "costo_unitario_pactado": 95.00
         }
       ]
     }'
```
*Resultado esperado:* Si el producto tiene `precio_venta = 100.00` y `margen_minimo_pct = 15.00`, el costo de `95.00` supera el umbral (`100 * (1 - 0.15) = 85.00`). El sistema debe registrar la orden **y** emitir la alerta.

```bash
# Verificar que la alerta fue registrada en auditoría
curl -X GET "http://localhost:8000/api/v1/admin/auditoria?tipo=ALERTA_MARGEN" \
     -H "Accept: application/json"
```

---

## 2. Clasificación Estratégica de Producto (rol Director)

```bash
curl -X PATCH "http://localhost:8000/api/v1/productos/00000000-0000-0000-0000-000000000001/clasificacion" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <token-director>" \
     -d '{"tipo_estrategico": "GANCHO"}'
```
*Respuesta esperada (HTTP 200):* Objeto del producto con `tipo_estrategico: "GANCHO"`.

---

## 3. Visualización de la Matriz Margen-Rotación

```bash
curl -X GET "http://localhost:8000/api/v1/bi/matriz-margen-rotacion" \
     -H "Accept: application/json"
```
*Respuesta esperada (HTTP 200):* Array de objetos con `velocidad_venta_diaria` y `margen_bruto_pct` por producto, listo para alimentar el `ScatterChart`.

---

## 4. Verificación en Base de Datos

```sql
-- Confirmar snapshot de margen en detalle de ventas
SELECT producto_id, precio_unitario_cobrado, costo_unitario_lote,
       ROUND((precio_unitario_cobrado - costo_unitario_lote) / precio_unitario_cobrado * 100, 2) AS margen_calculado_pct
FROM detalle_ventas
ORDER BY created_at DESC
LIMIT 10;
```
