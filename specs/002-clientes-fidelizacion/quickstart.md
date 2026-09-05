# Guía Rápida de Verificación (Quickstart): 002 - Clientes, Segmentación RFM y Fidelización

**Módulo:** 002-clientes-fidelizacion  
**Objetivo:** Verificar en menos de 3 minutos que el alta de cliente, la búsqueda por teléfono y el canje de cupón funcionan correctamente.

---

## 1. Alta Rápida de Cliente desde POS

```bash
curl -X POST "http://localhost:8000/api/v1/clientes/" \
     -H "Content-Type: application/json" \
     -d '{
       "telefono": "5512345678",
       "nombre": "María García",
       "email": "maria@example.com",
       "fecha_nacimiento": "1990-10-15"
     }'
```
*Respuesta esperada (HTTP 201):* JSON con `id` (UUID), `telefono`, `nombre` y `segmento_rfm: null` (aún sin compras).

---

## 2. Búsqueda de Cliente por Teléfono

```bash
curl -X GET "http://localhost:8000/api/v1/clientes/buscar?telefono=5512345678" \
     -H "Accept: application/json"
```
*Respuesta esperada (HTTP 200):* Datos del cliente incluyendo `ciclo_intercompra_dias` y `segmento_rfm`.

---

## 3. Canje de Cupón de Descuento en POS

```bash
curl -X POST "http://localhost:8000/api/v1/pos/canjear-cupon" \
     -H "Content-Type: application/json" \
     -d '{
       "codigo_cupon": "CUMPLE-20261015-AB12",
       "venta_id": "00000000-0000-0000-0000-000000000099"
     }'
```
*Respuesta esperada (HTTP 200):* JSON con `descuento_aplicado` y `nuevo_total_pagar`.  
*Si el cupón ya fue canjeado:* HTTP 409 con mensaje de error descriptivo.

---

## 4. Verificación de Clientes en Riesgo

```bash
curl -X GET "http://localhost:8000/api/v1/admin/clientes/en-riesgo" \
     -H "Accept: application/json"
```
*Respuesta esperada (HTTP 200):* Array de clientes con segmento `CAMPEON` o `LEAL` que superaron su ciclo de compra.

---

## 5. Verificación en Base de Datos

```sql
-- Confirmar alta de cliente
SELECT id, telefono, nombre, opt_in_marketing FROM clientes WHERE telefono = '5512345678';

-- Confirmar cupón canjeado
SELECT codigo, estado, venta_canje_id FROM cupones WHERE cliente_id = '<id-del-cliente>';
```
