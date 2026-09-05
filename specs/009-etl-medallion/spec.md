# Especificación Funcional: 009 - Pipeline ETL Medallion (Bronze / Silver / Gold)

**Módulo:** 009-etl-medallion  
**Nivel Organizacional:** Transversal (alimenta los niveles Táctico y Estratégico)  
**Estado:** DRAFT / LISTO PARA IMPLEMENTACIÓN  
**Dependencias:** 001-core-ventas-inventario (fuente de datos principal)  
**Documentos de referencia:**  
* [docs/arquitectura/etl_medallion_architecture.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/arquitectura/etl_medallion_architecture.md)

---

## 1. Declaración del Problema y Objetivos

El sistema Quantix produce datos transaccionales ricos (ventas, lotes, arqueos, clientes) en PostgreSQL. Sin un pipeline confiable, estructurado y auditable que lleve esos datos a un modelo dimensional, los tableros de BI estarían leyendo directamente del OLTP (violación del Artículo III de la Constitución) o no existirían.

Este módulo define, implementa y controla el pipeline ETL completo bajo la arquitectura **Medallion de tres capas** dentro de DuckDB.

---

## 2. Historias de Usuario y Criterios de Aceptación

### Historia 1: Registro Confiable de Ejecuciones
* **Como** administrador técnico,  
* **Quiero** ver en cualquier momento el estado de cada ejecución del pipeline ETL (cuándo corrió, cuántas filas procesó, si hubo errores),  
* **Para** saber si los datos en los dashboards están actualizados y poder diagnosticar fallos sin revisar logs de aplicación.

```gherkin
Escenario: Ejecución exitosa del micro-batch
  Dado que hay 150 ventas nuevas en PostgreSQL desde el último batch
  Cuando el job etl_micro_batch se ejecuta
  Entonces se insertan 150 filas en bronze.ventas
  Y se validan y limpian 148 filas hacia silver.ventas (2 rechazadas a rejection_log)
  Y se generan las filas correspondientes en gold.fact_ventas
  Y se crea 1 registro en control.etl_control_log con estado='SUCCESS' para cada capa

Escenario: Fallo en extracción Bronze por PostgreSQL inaccesible
  Dado que PostgreSQL no responde
  Cuando el job etl_micro_batch se ejecuta
  Entonces el pipeline aborta en la capa Bronze
  Y se crea 1 registro en control.etl_control_log con estado='FAILED' y el mensaje de error
  Y Silver y Gold no se modifican (no hay propagación de fallos)

Escenario: Idempotencia del pipeline
  Dado que el mismo micro-batch se ejecuta dos veces con el mismo watermark
  Cuando se ejecuta por segunda vez
  Entonces el número de filas en Bronze/Silver/Gold no cambia
  Y el nuevo registro en etl_control_log muestra filas_insertadas=0
```

---

## 3. Criterios Técnicos Adicionales

* El pipeline usa `DuckDB postgres_scanner` para conectar directamente con PostgreSQL sin scripts intermedios.
* Cada ejecución calcula y almacena el `watermark_fin` (máximo timestamp procesado) para la siguiente ejecución incremental.
* El pipeline nunca elimina datos de Bronze (append-only). Silver se puede reconstruir desde Bronze.
* La tabla `dim_tiempo` se genera una sola vez para el rango 2020-2035 y no se recalcula.
* `dim_producto` implementa SCD Tipo 2: si un producto cambia de clasificación estratégica o precio, se cierra el registro anterior y se abre uno nuevo.
