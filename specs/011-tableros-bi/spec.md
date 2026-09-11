# Especificación Funcional: 011 - Tableros de Business Intelligence y Estadística Avanzada

**Módulo:** 011-tableros-bi  
**Nivel Organizacional:** Estratégico y Táctico (EIS / BI)  
**Estado:** IMPLEMENTADO / VERIFICADO  
**Base Analítica:** DuckDB Capa Gold (`quantix_analytics.duckdb`)  
**Dependencias:** 009-etl-medallion  

---

## 1. Declaración del Problema y Objetivos
Los directores de retail y supervisores de operaciones necesitan visualizar en tiempo real la salud financiera y operativa del negocio sin degradar el rendimiento de la base de datos de cobro. Esto exige indicadores agregados de alto nivel, matrices visuales de concentración, mapas de afluencia temporal y proyecciones matemáticas rigurosas.

Este módulo implementa el ecosistema de Business Intelligence de Quantix:
* Consultas ultra-rápidas ejecutadas al 100% sobre la capa columnar **DuckDB Gold**, garantizando tiempos de respuesta $< 100$ ms sobre millones de registros históricos.
* Cuadro de mando ejecutivo en `Dashboard.tsx`: KPIs clave (Ingresos del Mes, Margen Promedio, comparativas vs. período anterior), gráfica interactiva de 7 días (Ingresos vs. Margen) y proyecciones de demanda inmediata.
* Suite analítica profunda en `Analisis.tsx`:
  - **KPIs Ejecutivos Multidimensionales:** Ingresos Netos, Margen Bruto %, Ticket Promedio, Transacciones, Clientes Únicos y Unidades Vendidas con variación porcentual (+/- %).
  - **Tendencias Temporales Interactivas:** Gráficos de área y líneas Recharts comparando ingresos y margen con granularidad seleccionable (Diario, Semanal, Mensual).
  - **Matriz de Pareto ABC:** Clasificación 80/15/5 del catálogo con barras acumuladas y porcentajes de contribución.
  - **Segmentación RFM Dinámica:** Agrupación algorítmica de clientes en 9 segmentos estratégicos (Campeones, Leales, En Riesgo, Dormidos, etc.) con recomendaciones comerciales.
  - **Heatmap 7x24 de Estacionalidad:** Matriz cromática de transacciones y afluencia por día de la semana y franja horaria.
  - **Inferencia Predictiva Z / Student-t:** Proyecciones de demanda con intervalos de confianza al 95% según el Teorema del Límite Central.
* Sincronización reactiva con el selector de sucursal global (`useSucursalStore`): los supervisores visualizan automáticamente las métricas de su sede con candado visual; los directores alternan sedes o analizan el consolidado global.

---

## 2. Endpoints Analíticos Implementados

| Endpoint | Router | Propósito y Salida |
| :--- | :--- | :--- |
| `GET /api/v1/dashboard/estrategico` | `analitica.py` | KPIs mensuales, serie temporal 7 días y demanda estimada. |
| `GET /api/v1/reportes/analisis/kpis-avanzados` | `reportes.py` | Métricas ejecutivas multidimensionales con delta %. |
| `GET /api/v1/reportes/analisis/tendencias` | `reportes.py` | Series cronológicas con selector DIA/SEMANA/MES. |
| `GET /api/v1/reportes/analisis/abc-productos` | `reportes.py` | Ranking Pareto ABC con facturación acumulada. |
| `GET /api/v1/reportes/analisis/rfm-clientes` | `reportes.py` | Segmentación algorítmica RFM calculada con NTILE(5). |
| `GET /api/v1/reportes/analisis/estacionalidad` | `reportes.py` | Matriz 7 días x franjas 08:00 a 22:00. |
| `GET /api/v1/reportes/analisis/proyecciones` | `reportes.py` | Inferencia Normal Z ($n \ge 30$) o Student-t ($n < 30$) al 95%. |

---

## 3. Historias de Usuario y Criterios de Aceptación Verificados

### Historia 1: Visualización Ejecutiva de Tendencias y Margen
```gherkin
Escenario: Consulta de tendencias con cambio de periodicidad
  Dado el conjunto de hechos gold.fact_ventas en DuckDB
  Cuando el director selecciona periodicidad = "SEMANA" en Analisis.tsx
  Entonces el endpoint /reportes/analisis/tendencias devuelve las ventas y márgenes agrupados por semana
  Y Recharts renderiza las áreas continuas con tooltips detallados de margen porcentual.
```

### Historia 2: Inferencia de Demanda con Selección Automática Z/t
```gherkin
Escenario: Cálculo de demanda para SKU con muestra reducida
  Dado un artículo nuevo con 14 días de ventas
  Cuando el backend procesa las proyecciones
  Entonces identifica n = 14 < 30 y aplica distribución Student-t con 13 grados de libertad
  Y proyecta el límite inferior y superior al 95% de confianza
  Y asigna el semáforo predictivo según el stock actual disponible en la sucursal.
```
