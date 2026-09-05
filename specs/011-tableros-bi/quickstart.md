# Quickstart: Dashboard Estratégico

El dashboard estratégico ofrece métricas proyectadas de demanda e intervalos de confianza utilizando inferencia estadística (Distribuciones Z y T de Student) sobre la capa Gold en DuckDB.

## Ejecución de Prueba

Puedes probar el endpoint usando `cURL`:

```bash
curl -X GET "http://localhost:8000/api/v1/dashboard/estrategico" \
     -H "Authorization: Bearer <TU_TOKEN_JWT>" \
     -H "Content-Type: application/json"
```

## Ejemplo de Respuesta

```json
{
  "proyecciones_demanda": [
    {
      "producto_id": "PRD-001",
      "stock_seguridad": 150.5,
      "distribucion_usada": "Z",
      "intervalo_confianza": "95%",
      "dias_historico": 120
    },
    {
      "producto_id": "PRD-002",
      "stock_seguridad": 45.2,
      "distribucion_usada": "T-Student",
      "intervalo_confianza": "90%",
      "dias_historico": 15
    }
  ]
}
```
