# Guía Rápida de Verificación: 008 - Operación Offline y Sincronización

**Módulo:** 008-offline-sync  

---

## 1. Verificación del Heartbeat de Red
```bash
curl -X GET "http://localhost:8000/api/v1/health" \
     -H "Accept: application/json"
```
*Respuesta esperada (HTTP 200 en < 20 ms):*
```json
{
  "status": "ok",
  "timestamp": "2026-09-04T23:30:00Z"
}
```

---

## 2. Prueba de Sincronización de Ventas en Lote
Simular el envío de una venta registrada en SQLite local tras recuperar la conectividad:
```bash
curl -X POST "http://localhost:8000/api/v1/sync/ventas-offline" \
     -H "Content-Type: application/json" \
     -d '{
       "ventas": [
         {
           "id_local": "550e8400-e29b-41d4-a716-446655440000",
           "fecha_hora": "2026-09-04T23:25:00Z",
           "subtotal": 12.00,
           "total_pagar": 12.00,
           "items": [
             {
               "producto_id": "00000000-0000-0000-0000-000000000001",
               "cantidad": 1,
               "precio_unitario": 12.00
             }
           ]
         }
       ]
     }'
```
*Respuesta esperada (HTTP 200):*
```json
{
  "procesadas": 1,
  "exitosas": 1,
  "conflictos": 0,
  "detalles": [
    {
      "id_local": "550e8400-e29b-41d4-a716-446655440000",
      "estado": "SINCRONIZADA",
      "mensaje": "Venta integrada y stock FEFO descontado"
    }
  ]
}
```
