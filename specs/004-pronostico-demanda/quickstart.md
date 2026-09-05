# Guía Rápida de Verificación (Quickstart): 004 - Pronóstico de Demanda y Reposición

**Módulo:** 004-pronostico-demanda  
**Objetivo:** Verificar en menos de 3 minutos que las sugerencias de reorden y la detección de sobrestock funcionan correctamente.

---

## 1. Verificar Sugerencias de Reposición

```bash
curl -X GET "http://localhost:8000/api/v1/admin/inventario/sugerencias-reposicion" \
     -H "Accept: application/json"
```
*Respuesta esperada (HTTP 200):* Array de productos ordenados por urgencia, con `stock_disponible_total <= punto_reorden`. Si el array está vacío, todos los productos tienen stock suficiente.

---

## 2. Verificar Detección de Sobrestock

```bash
curl -X GET "http://localhost:8000/api/v1/admin/inventario/sobrestock" \
     -H "Accept: application/json"
```
*Respuesta esperada (HTTP 200):* Array de productos con `dias_inventario_proyectados > 90` (o el valor configurado en `CONFIGURACION.inventario_dias_sobrestock`).

---

## 3. Verificación en DuckDB — Consistencia del ETL

```sql
-- Verificar que el ETL marcó correctamente los días con rotura de stock
SELECT producto_id, fecha, stock_disponible_fin, cantidad_rotura_stock
FROM FACT_INVENTARIO_DIARIO
WHERE cantidad_rotura_stock > 0
ORDER BY fecha DESC
LIMIT 20;

-- Verificar la velocidad calculada excluyendo días con rotura
SELECT producto_id,
       COUNT(*) FILTER (WHERE cantidad_rotura_stock = 0) AS dias_con_stock,
       SUM(unidades_vendidas) AS total_unidades,
       SUM(unidades_vendidas) * 1.0 / NULLIF(COUNT(*) FILTER (WHERE cantidad_rotura_stock = 0), 0) AS velocidad_calculada
FROM FACT_INVENTARIO_DIARIO
WHERE fecha >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY producto_id
ORDER BY velocidad_calculada DESC
LIMIT 10;
```

---

## 4. Simular Rotura de Stock para Validar Exclusión

```sql
-- Insertar manualmente un día con rotura de stock para validar la exclusión del promedio
UPDATE FACT_INVENTARIO_DIARIO
SET stock_disponible_fin = 0, cantidad_rotura_stock = 24
WHERE producto_id = '00000000-0000-0000-0000-000000000001'
  AND fecha = CURRENT_DATE - 5;

-- Volver a consultar: la velocidad del SKU debe aumentar ligeramente
-- al excluir ese día del denominador
```
