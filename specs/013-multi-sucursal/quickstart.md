# Quickstart

Ejemplo rápido para interactuar con la nueva API y crear una sucursal usando `cURL`.

## Crear una Sucursal

```bash
curl -X POST http://localhost:8080/api/v1/admin/sucursales \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TU_TOKEN_AQUI>" \
  -d '{
    "nombre": "Sucursal Centro",
    "direccion": "Av. Principal 123",
    "telefono": "555-1234"
  }'
```

Una vez creada la sucursal, puedes utilizar su ID para crear terminales de caja.
