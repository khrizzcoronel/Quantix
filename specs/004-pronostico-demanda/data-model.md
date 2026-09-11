# Modelo de Datos y Algoritmos: 004 - Pronóstico de Demanda y Reaprovisionamiento

**Módulo:** 004-pronostico-demanda  
**Esquema:** Algoritmos Transaccionales (PostgreSQL) + Inferencia Estadística (DuckDB Gold)

---

## 1. Algoritmo Operativo de Sugerencias de Reorden (`sugerencias_reorden_compra`)

El servicio operativo ejecutado en `GET /api/v1/inventario/ordenes-compra/sugerencias` procesa los datos relacionales de PostgreSQL bajo la siguiente formulación matemática:

```python
# Parámetros calibrados por clasificación ABC
STOCK_SEGURIDAD_ABC = {
    'A': 15.0,  # Alta rotación (Top 80% facturación)
    'B': 10.0,  # Media rotación (15% facturación)
    'C': 5.0    # Baja rotación (5% facturación)
}

# 1. Velocidad diaria de venta (últimos 30 días)
velocidad_diaria = total_unidades_vendidas_ultimos_30_dias / 30.0

# 2. Lead time del proveedor habitual
lead_time = proveedor.lead_time_dias if proveedor else 7

# 3. Punto de reorden dinámico
punto_reorden = math.ceil((velocidad_diaria * lead_time) + STOCK_SEGURIDAD_ABC.get(producto.clasificacion_abc, 5.0))

# 4. Condición de disparo de reorden
requiere_compra = stock_actual_sucursal <= punto_reorden

# 5. Cantidad sugerida a ordenar
cantidad_sugerida = max(math.ceil((punto_reorden * 2) - stock_actual_sucursal), 10)
```

---

## 2. Modelado Analítico en DuckDB Gold

### Inferencia Estadística Z / Student-t (`gold.fact_ventas`)
```sql
WITH ventas_diarias AS (
    SELECT 
        v.producto_id,
        p.sku,
        p.nombre,
        p.clasificacion_abc,
        CAST(v.fecha_hora AS DATE) AS fecha,
        SUM(v.cantidad) AS unidades_dia
    FROM gold.fact_ventas v
    JOIN gold.dim_producto p ON v.producto_id = p.producto_id
    WHERE v.estado = 'COMPLETADA'
      AND (:sucursal_id IS NULL OR v.sucursal_id = :sucursal_id)
    GROUP BY v.producto_id, p.sku, p.nombre, p.clasificacion_abc, CAST(v.fecha_hora AS DATE)
),
estadisticas_muestra AS (
    SELECT 
        producto_id,
        sku,
        nombre,
        clasificacion_abc,
        COUNT(fecha) AS n_muestras,
        AVG(unidades_dia) AS media_diaria,
        STDDEV(unidades_dia) AS desviacion_estandar
    FROM ventas_diarias
    GROUP BY producto_id, sku, nombre, clasificacion_abc
)
SELECT 
    producto_id,
    sku,
    nombre,
    n_muestras,
    media_diaria,
    COALESCE(desviacion_estandar, 0) AS desviacion_estandar,
    CASE 
        WHEN n_muestras >= 30 THEN 'NORMAL_Z'
        ELSE 'STUDENT_T'
    END AS distribucion_usada
FROM estadisticas_muestra;
```

### Matriz de Estacionalidad Semanal y Horaria ($7 \times 24$)
```sql
SELECT 
    EXTRACT(DOW FROM v.fecha_hora) AS dia_semana, -- 0=Domingo, 1=Lunes, ..., 6=Sábado
    EXTRACT(HOUR FROM v.fecha_hora) AS hora_dia,
    COUNT(DISTINCT v.id) AS total_transacciones,
    SUM(v.total_pagar) AS volumen_ventas,
    AVG(v.total_pagar) AS ticket_promedio
FROM gold.fact_ventas v
WHERE v.estado = 'COMPLETADA'
  AND (:sucursal_id IS NULL OR v.sucursal_id = :sucursal_id)
GROUP BY EXTRACT(DOW FROM v.fecha_hora), EXTRACT(HOUR FROM v.fecha_hora)
ORDER BY dia_semana ASC, hora_dia ASC;
```
