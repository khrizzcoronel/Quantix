# Quickstart: Transferencias Inter-Sucursales (Módulo 015)

Guía rápida para solicitar, despachar y recepcionar un traspaso de inventario entre dos sucursales usando cURL.

## 1. Solicitar Transferencia

```bash
curl -X POST http://localhost:8000/api/v1/sucursales/transferencias \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TU_JWT_TOKEN>" \
  -d '{
    "sucursal_origen_id": "<ID_SUCURSAL_ORIGEN>",
    "sucursal_destino_id": "<ID_SUCURSAL_DESTINO>",
    "notas": "Traspaso por alta demanda de fin de semana",
    "items": [
      {
        "producto_id": "<ID_PRODUCTO>",
        "lote_origen_id": "<ID_LOTE_ORIGEN>",
        "cantidad": 10.0
      }
    ]
  }'
```

## 2. Despachar Mercancía (Poner EN_TRANSITO)

```bash
curl -X POST http://localhost:8000/api/v1/sucursales/transferencias/<ID_TRANSFERENCIA>/despachar \
  -H "Authorization: Bearer <TU_JWT_TOKEN>"
```

## 3. Confirmar Recepción Física en Destino (Marcar RECIBIDA)

```bash
curl -X POST http://localhost:8000/api/v1/sucursales/transferencias/<ID_TRANSFERENCIA>/recibir \
  -H "Authorization: Bearer <TU_JWT_TOKEN>"
```
