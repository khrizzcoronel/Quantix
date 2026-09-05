# Plan de Implementación: 011 - Tableros BI y Distribución de Información

## 1. Arquitectura de Distribución de la Información (Pirámide de Anthony)

El backend expondrá tres perfiles de tableros distintos, enrutando las consultas a diferentes motores de base de datos según el nivel organizacional para aislar las cargas de trabajo:

| Nivel Organizacional | Endpoint Base | Motor de Base de Datos | Enfoque |
| :--- | :--- | :--- | :--- |
| **1. Operativo** | `/api/v1/dashboard/operativo` | **PostgreSQL (OLTP)** | Tiempo real. Ventas del turno activo, tickets en proceso, stock vivo. |
| **2. Táctico** | `/api/v1/dashboard/tactico` | **DuckDB (OLAP - Gold)** | Agregaciones a corto/mediano plazo. Mermas, caducidades FEFO, descuadres de caja. |
| **3. Estratégico** | `/api/v1/dashboard/estrategico` | **DuckDB (OLAP - Gold)** | Analítica profunda e inferencia estadística (Distribuciones Z y T). |

## 2. Implementación de los Endpoints

### A. Dashboard Operativo (PostgreSQL)
Se utilizará SQLAlchemy `AsyncSession` tradicional. Las consultas son simples `SELECT` con `WHERE fecha = HOY` o conteos directos sobre tablas indexadas (`ventas`, `sesiones_caja`).

### B. Dashboard Táctico (DuckDB)
Consultas SQL analíticas estándar sobre las tablas `fact_ventas`, `fact_arqueos_merma` y `fact_inventario_diario`. Devuelve series de tiempo semanales o mensuales.

### C. Dashboard Estratégico (DuckDB + Inferencia Estadística)
El endpoint calculará métricas predictivas aplicando:
1. **Distribución Z (Normal):** Para productos con historial amplio ($n \ge 30$). Se aplicará para estimar el Stock de Seguridad utilizando la desviación estándar de la demanda diaria.
2. **Distribución T de Student:** Para productos nuevos ($n < 30$). Los intervalos de confianza en proyecciones de venta serán penalizados (más anchos) para proteger el capital ante incertidumbre.
3. **LTV (Lifetime Value):** Combinación de margen promedio y retención desde `fact_cliente_rfm_periodo`.

## 3. Tareas a Ejecutar
- [ ] **TASK-011-01:** Implementar endpoint `GET /api/v1/dashboard/operativo` (Conexión a PostgreSQL - Métricas del día en vivo).
- [ ] **TASK-011-02:** Implementar endpoint `GET /api/v1/dashboard/tactico` (Conexión a DuckDB - Mermas, rotación y caducidades a 30 días).
- [ ] **TASK-011-03:** Implementar endpoint `GET /api/v1/dashboard/estrategico` (Conexión a DuckDB - Rentabilidad global).
- [ ] **TASK-011-04:** Implementar motor estadístico en `GET /api/v1/bi/proyecciones` (DuckDB + Pandas/SciPy para cálculos de distribución Z/T).
