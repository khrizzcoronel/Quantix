# Guía Rápida de Verificación: 009 - Pipeline ETL Medallion

**Módulo:** 009-etl-medallion  

---

## 1. Verificar Estado del Pipeline desde la API

```bash
# Ver últimas 10 ejecuciones de todas las capas
curl -X GET "http://localhost:8000/api/v1/admin/etl/estado?limite=10" \
     -H "Authorization: Bearer <supervisor_token>"

# Ver solo ejecuciones fallidas
curl "http://localhost:8000/api/v1/admin/etl/estado?estado=FAILED&limite=5" \
     -H "Authorization: Bearer <token>"
```

*Respuesta esperada (sistema operativo normal):*
```json
{
  "ultima_actualizacion_exitosa": "2026-09-05T14:00:03Z",
  "total_fallos_ultimas_24h": 0,
  "ejecuciones": [
    {
      "pipeline_name": "gold_fact_ventas",
      "capa": "GOLD",
      "estado": "SUCCESS",
      "filas_insertadas": 450,
      "filas_rechazadas": 0,
      "duracion_segundos": 1.23,
      "watermark_fin": "2026-09-05T13:59:58Z"
    }
  ]
}
```

---

## 2. Consultar Registros Rechazados en Silver

```bash
curl "http://localhost:8000/api/v1/admin/etl/rechazos?tabla_origen=ventas" \
     -H "Authorization: Bearer <token>"
```

---

## 3. Verificar Directamente en DuckDB (Desarrollo)

```python
import duckdb
conn = duckdb.connect("quantix_analytics.duckdb")

# Últimas ejecuciones
conn.execute("""
    SELECT pipeline_name, capa, estado, filas_insertadas, duracion_segundos
    FROM control.etl_control_log
    ORDER BY inicio DESC
    LIMIT 20
""").df()

# Registros rechazados en Silver
conn.execute("SELECT * FROM silver.rejection_log ORDER BY registrado_en DESC").df()

# Contar filas en Gold
conn.execute("SELECT COUNT(*) FROM gold.fact_ventas").fetchone()
```

---

## 4. Test de Idempotencia Manual

```bash
# Ejecutar el micro-batch manualmente dos veces (solo en entorno dev)
curl -X POST "http://localhost:8000/api/v1/admin/etl/ejecutar-ahora" \
     -H "Authorization: Bearer <dev_token>"

# Esperar 5 segundos
sleep 5

curl -X POST "http://localhost:8000/api/v1/admin/etl/ejecutar-ahora" \
     -H "Authorization: Bearer <dev_token>"

# Verificar que la segunda ejecución tenga filas_insertadas=0
curl "http://localhost:8000/api/v1/admin/etl/estado?limite=2"
```
