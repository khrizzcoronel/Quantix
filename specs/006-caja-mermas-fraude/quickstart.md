# Guía Rápida de Verificación (Quickstart): 006 - Caja, Mermas y Detección de Fraude

**Módulo:** 006-caja-mermas-fraude  
**Objetivo:** Verificar el flujo completo de apertura de sesión, registro de una venta, arqueo ciego y cierre con detección de discrepancia.

---

## 1. Apertura de Sesión de Caja

```bash
curl -X POST "http://localhost:8000/api/v1/caja/sesiones/abrir" \
     -H "Content-Type: application/json" \
     -d '{
       "cajero_usuario_id": "00000000-0000-0000-0000-000000000050",
       "terminal_id": "TERMINAL-01",
       "fondo_inicial": 500.00
     }'
```
*Respuesta esperada (HTTP 201):* JSON con `id` de la sesión y `estado: "ABIERTA"`.  
Guardar el `id` de la sesión para los pasos siguientes: `SESION_ID`.

---

## 2. Registrar una Venta en la Sesión Activa

```bash
curl -X POST "http://localhost:8000/api/v1/pos/checkout" \
     -H "Content-Type: application/json" \
     -d '{
       "sesion_caja_id": "<SESION_ID>",
       "items": [
         {"producto_id": "00000000-0000-0000-0000-000000000001", "cantidad": 3}
       ]
     }'
```
*Respuesta esperada (HTTP 201):* Ticket generado con `total_pagar` (ej. 150.00 MXN en efectivo).

---

## 3. Arqueo Ciego — Simular Faltante

Ingresar un monto menor al esperado para disparar la alerta de discrepancia:

```bash
curl -X POST "http://localhost:8000/api/v1/caja/sesiones/<SESION_ID>/arqueo-ciego" \
     -H "Content-Type: application/json" \
     -d '{
       "efectivo_contado": 600.00,
       "comprobantes_tarjeta": 0.00
     }'
```
*Respuesta esperada (HTTP 200):* 
- `total_teorico`: 650.00 (fondo 500 + venta 150)
- `diferencia`: -50.00 (faltante)
- `requiere_revision`: true (si la tolerancia configurada es < 50.00 MXN)

---

## 4. Verificar Registro Forense en Auditoría

```bash
curl -X GET "http://localhost:8000/api/v1/admin/caja/auditoria?tipo_evento=DISCREPANCIA_ARQUEO" \
     -H "Accept: application/json"
```
*Respuesta esperada (HTTP 200):* Array con al menos un evento de tipo `DISCREPANCIA_ARQUEO` con `detalle_json` que incluye `diferencia`, `sesion_caja_id` e `ip_terminal`.

---

## 5. Verificar en Base de Datos

```sql
-- Estado final de la sesión
SELECT id, estado, fecha_apertura, fecha_cierre FROM sesiones_caja WHERE id = '<SESION_ID>';

-- Detalle del arqueo
SELECT efectivo_contado, total_teorico, diferencia, requiere_revision
FROM arqueos_caja WHERE sesion_caja_id = '<SESION_ID>';

-- Registro forense inmutable
SELECT tipo_evento, detalle_json, registrado_en FROM auditoria_eventos
WHERE tipo_evento = 'DISCREPANCIA_ARQUEO'
ORDER BY registrado_en DESC LIMIT 5;
```
