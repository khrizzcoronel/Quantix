# Especificación Funcional: 011 - Tableros BI y Estadística

**Módulo:** 011-tableros-bi  
**Base Analítica:** DuckDB (Capa Gold del ETL)

## 1. Objetivo
Exponer los datos pre-calculados por el pipeline ETL hacia el Frontend mediante endpoints optimizados, aplicando algoritmos estadísticos (Distribución Z y T de Student) para toma de decisiones y proyección de demanda.

## 2. Requerimientos Estadísticos
El sistema aplicará distribuciones estadísticas para analizar desviaciones y proyectar ventas:
1. **Distribución Normal (Z):** Utilizada cuando el histórico de un producto tiene una muestra grande ($n \ge 30$ días). Se usará para calcular el **Stock de Seguridad** basado en un nivel de servicio (ej. $Z = 1.65$ para 95%).
2. **Distribución T de Student:** Utilizada para productos de reciente introducción ($n < 30$ días) para estimar intervalos de confianza más conservadores en la proyección de demanda debido a la mayor incertidumbre.

## 3. Tareas a Ejecutar
- [ ] **TASK-011-01:** Implementar endpoint estadístico `GET /api/v1/bi/demanda/proyeccion` que conecte con DuckDB, calcule la desviación estándar ($\sigma$) histórica y aplique Distribución Z o T según el conteo de datos ($n$).
- [ ] **TASK-011-02:** Implementar endpoint `GET /api/v1/bi/mermas/tactico` (Top 10 productos caducados, cajeros con más descuadres).
- [ ] **TASK-011-03:** Implementar endpoint `GET /api/v1/bi/rentabilidad/matriz` (Cuadrante Margen vs. Rotación).
