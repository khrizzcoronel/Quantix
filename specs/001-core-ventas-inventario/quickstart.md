# Guía Rápida de Verificación (Quickstart): 001 - Core de Ventas e Inventario

**Módulo:** 001-core-ventas-inventario  
**Objetivo:** Instrucciones para que un agente o desarrollador verifique en menos de 2 minutos que la funcionalidad FEFO y el POS están operando correctamente.

---

## 1. Verificación del Backend (cURL)

### Paso 1: Buscar producto por código de barras
```bash
curl -X GET "http://localhost:8000/api/v1/pos/buscar-producto?q=7501001" \
     -H "Accept: application/json"
```
*Respuesta esperada (HTTP 200):* Datos del producto con precio de venta y stock total sumado de todos sus lotes.

---

### Paso 2: Ejecutar venta con descarga FEFO
```bash
curl -X POST "http://localhost:8000/api/v1/pos/checkout" \
     -H "Content-Type: application/json" \
     -d '{
       "items": [
         {
           "producto_id": "00000000-0000-0000-0000-000000000001",
           "cantidad": 2
         }
       ]
     }'
```
*Respuesta esperada (HTTP 201):* Ticket emitido con `folio_ticket`, `total_pagar` y `margen_total_ganancia`.

---

## 2. Verificación de la Regla FEFO en Base de Datos
Ejecutar la consulta para verificar que el lote con fecha más antigua redujo su stock antes que los demás:
```sql
SELECT numero_lote, fecha_vencimiento, cantidad_inicial, cantidad_disponible 
FROM lotes_inventario 
WHERE producto_id = '00000000-0000-0000-0000-000000000001'
ORDER BY fecha_vencimiento ASC;
```
