# Tareas de Implementación: 011 - Tableros BI y Estadística

A continuación se detallan las tareas para la implementación de los endpoints de los tres perfiles de tableros:

- [ ] **TASK-011-01 (Operativo):** Implementar endpoint `GET /api/v1/dashboard/operativo`. 
  - Conexión: PostgreSQL (OLTP) mediante SQLAlchemy `AsyncSession`.
  - Enfoque: Ventas del turno activo, tickets en proceso, stock vivo (tiempo real).
  
- [ ] **TASK-011-02 (Táctico):** Implementar endpoint `GET /api/v1/dashboard/tactico`.
  - Conexión: DuckDB (Capa Gold).
  - Enfoque: Mermas, caducidades FEFO, descuadres de caja y agregaciones a corto/mediano plazo.

- [ ] **TASK-011-03 (Estratégico):** Implementar endpoint `GET /api/v1/dashboard/estrategico`.
  - Conexión: DuckDB (Capa Gold) + Motor Estadístico.
  - Enfoque: Analítica profunda, rentabilidad global e inferencia estadística.
  - Cálculos: Aplicación de Distribución Normal (Z) para historial amplio ($n \ge 30$) y Distribución T de Student para productos nuevos ($n < 30$) en la proyección de demanda y estimación del stock de seguridad.
