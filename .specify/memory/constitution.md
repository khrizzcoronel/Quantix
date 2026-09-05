# Constitución del Proyecto: Quantix (Comercio Inteligente)

**Versión:** 2.0.0  
**Fecha de Ratificación:** Septiembre 2026  
**Metodología:** Spec-Driven Development (SDD) con Spec Kit  
**Propósito:** Establecer los principios inmutables, restricciones de arquitectura, estándares de ingeniería y gobernanza para todo agente de programación o desarrollador humano que participe en este repositorio.

---

## 1. Principios Fundamentales (Invariantes del Proyecto)

### Artículo I: Primacía de las Especificaciones (Spec-First)
1. **Ninguna línea de código de producción o prueba se escribirá sin una especificación previa.**  
   Toda funcionalidad debe originarse en un directorio `specs/XXX-nombre/` con su correspondiente `spec.md`, `plan.md`, `data-model.md` y `tasks.md`.
2. Las especificaciones son contratos vinculantes: el código debe ajustarse a la especificación, no al revés. Si la realidad técnica impone un cambio, se actualiza primero la especificación mediante revisión explícita.

### Artículo II: Alineación con la Pirámide de Anthony
Todo módulo y contrato debe responder y clasificarse explícitamente en uno de los niveles organizacionales:
* **Nivel Operativo (TPS / POS):** Prioridad en latencia (< 200 ms), operación offline y simplicidad de UI.
* **Nivel Táctico (MIS / DSS):** Monitoreo de mermas, alertas FEFO, puntos de reorden y automatización de clientes.
* **Nivel Estratégico (EIS / BI):** Visión global de márgenes, rentabilidad del catálogo y segmentación RFM / LTV.

### Artículo III: Segregación Estricta OLTP vs. OLAP (Medallion Architecture)
1. La base de datos operativa (**PostgreSQL 16**) se reserva exclusivamente para transacciones ACID de caja, inventario y autenticación. Queda estrictamente prohibido ejecutar consultas analíticas agregadas o reportes históricos sobre ella en producción.
2. El flujo de datos analíticos sigue el patrón **Medallion Architecture** de tres capas dentro de DuckDB:
   * **Bronze (`bronze.*`):** Copia cruda inmutable del OLTP con timestamps de extracción. Sin transformaciones.
   * **Silver (`silver.*`):** Datos validados, limpios y normalizados. Los registros que no pasan validación van a `silver.rejection_log`.
   * **Gold (`gold.*`):** Modelo dimensional Kimball (FACT_* y DIM_*). Única capa consultada por dashboards y reportes.
3. El pipeline ETL es **UNIDIRECCIONAL**: solo lee de PostgreSQL y escribe en DuckDB. Nunca modifica el OLTP.
4. Toda ejecución del pipeline ETL genera un registro en la tabla `control.etl_control_log` dentro de DuckDB. Esta tabla es la fuente de verdad del estado del pipeline.
5. Ver referencia completa: [docs/arquitectura/etl_medallion_architecture.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/arquitectura/etl_medallion_architecture.md)

### Artículo IV: Cero Tolerancia a la Fuga de Valor
1. **Regla FEFO (*First Expired, First Out*):** El inventario perecedero se descarga obligatoriamente del lote con fecha de vencimiento más próxima.
2. **Arqueo Ciego:** Ninguna interfaz de cierre de caja debe mostrar al cajero el total teórico recaudado antes de registrar su declaración física.
3. **Inmutabilidad de Auditoría:** Toda anulación, descuento manual o apertura de cajón sin venta debe generar un registro inmutable `APPEND-ONLY`.

### Artículo V: Integridad de Datos — Solo Datos Reales

> [!CAUTION]
> **Toda inserción de datos en el sistema debe realizarse exclusivamente a través de la Capa Operativa (API de Quantix → PostgreSQL). No existen otras vías de ingesta válidas.**

1. **Prohibición de datos sintéticos persistentes:** Ningún agente, script, migración ni comando manual puede insertar registros ficticios (e.g. `"Producto Prueba"`, `"Cliente Test"`) en PostgreSQL ni en ninguna capa de DuckDB (Bronze, Silver, Gold).
2. **Datos de desarrollo temporal:** Si durante el desarrollo se crean datos para validar una funcionalidad, deben eliminarse antes del commit. La verificación `git status` antes de cada commit debe garantizar que no existen archivos `.sql` de seed o `.db` de prueba rastreados.
3. **Tests: aislados y sin persistencia:** Los tests de integración usan transacciones que se revierten automáticamente (rollback). Los tests unitarios usan objetos de dominio Pydantic en memoria. Ningún test deja datos en ninguna base de datos.
4. **El ETL no crea datos:** El pipeline ETL solo refleja lo que existe en el OLTP. No puede inventar, corregir ni inferir datos. Los errores de datos en la fuente se registran en `silver.rejection_log` y se notifican para corrección manual.

---

## 2. Stack Tecnológico Estandarizado

Para garantizar la velocidad de implementación (sprint de 48 horas) y minimizar fallos de compilación en agentes de IA:

* **Backend:** Python 3.11+ / FastAPI / Pydantic v2 / SQLAlchemy 2.0.
  * **Seguridad y Auth:** `passlib` (Argon2id/bcrypt), `PyJWT` para roles y tokens.
  * **Notificaciones:** `smtplib` nativo para emails, FastAPI WebSockets.
  * **Estadística BI:** `scipy` / `pandas` (para distribuciones Z/T inferenciales).
* **Base de Datos Operativa (OLTP):** PostgreSQL 16 (vía Docker Compose).
* **Base de Datos Analítica (OLAP):** DuckDB (archivo columnar embebido `quantix_analytics.duckdb`).
  * Esquemas internos: `bronze`, `silver`, `gold`, `control`.
* **Orquestación ETL:** APScheduler embebido en FastAPI — dos jobs:
  * `etl_micro_batch`: cada 5 minutos (ventas, caja, pagos).
  * `etl_nightly_batch`: 02:00 AM (inventario, compras, RFM, SCD Tipo 2).
* **Frontend:** React 18 / Vite / TypeScript / Tailwind CSS / Lucide React / Recharts.
* **Testing:** pytest + pytest-asyncio + httpx (Backend) / Vitest + React Testing Library (Frontend).

---

## 3. Estructura Canónica de una Especificación (`specs/XXX-nombre/`)

Cada especificación en `specs/` debe contener estrictamente los siguientes artefactos:

| Archivo / Carpeta | Propósito |
| :--- | :--- |
| `spec.md` | Requisitos de negocio, historias de usuario y criterios de aceptación (Gherkin/Given-When-Then). |
| `plan.md` | Arquitectura técnica de la función, dependencias y riesgos. |
| `research.md` | Decisiones técnicas, alternativas descartadas y justificaciones. |
| `data-model.md` | Esquema relacional (OLTP) y/o dimensional (OLAP) impactado por el módulo. |
| `contracts/` | Contratos de API (OpenAPI YAML) que congelan los endpoints antes de codificar. |
| `tasks.md` | Lista granular de tareas ejecutables por agentes (checklist con orden de precedencia). |
| `quickstart.md` | Guía de pruebas rápidas (cURL, scripts o flujo de UI) para validar la spec. |

---

## 4. Reglas de Codificación y Control de Calidad

1. **Tipado Estricto:** Prohibido el uso de `Any` no justificado en Python y `any` en TypeScript.
2. **Idempotencia:** Todos los endpoints de cobro, actualización de stock y pipelines ETL deben ser idempotentes para evitar duplicaciones por reintentos de red.
3. **Manejo de Errores Semántico:** Las respuestas de error del API deben usar el estándar RFC 7807 (`application/problem+json`) o esquemas estructurados de error en Pydantic.
4. **Verificación Continua con Tests Obligatorios:** Cada tarea en `tasks.md` marcada como `[x]` debe tener sus tests correspondientes en `/tests` que pasen sin errores. Cobertura mínima por módulo: **80%**.

### 4.1 Norma de Tests por Integración
* Toda función de servicio nueva → test unitario en `tests/unit/backend/`.
* Todo endpoint nuevo o modificado → test de integración en `tests/integration/api/`.
* Todo pipeline ETL nuevo → tests de idempotencia y de control en `tests/integration/etl/` o `tests/unit/etl/`.
* Los tests se nombran siguiendo el patrón: `test_<que>__<condicion>__<resultado_esperado>`.
* Ver estándar completo: [docs/arquitectura/estandar_testing.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/arquitectura/estandar_testing.md)

---

## 5. Mapeo de Documentación Fundacional (`docs/`)

Todo agente de programación debe consultar los siguientes documentos fundacionales como fuentes canónicas de verdad antes de implementar o alterar cualquier especificación:

* **Estrategia Comercial:** [docs/negocio/estrategia_negocios.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/negocio/estrategia_negocios.md)
* **Marco Organizacional (Anthony):** [docs/negocio/analisis_organizacional.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/negocio/analisis_organizacional.md)
* **Diseño y Modelos de Datos (OLTP/OLAP):** [docs/arquitectura/diseno_arquitectura_datos.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/arquitectura/diseno_arquitectura_datos.md)
* **Arquitectura ETL Medallion (Bronze/Silver/Gold):** [docs/arquitectura/etl_medallion_architecture.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/arquitectura/etl_medallion_architecture.md)
* **Estándar de Testing:** [docs/arquitectura/estandar_testing.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/arquitectura/estandar_testing.md)
* **Stack y Plan de Implementación:** [docs/arquitectura/stack_tecnologico_plan_implementacion.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/arquitectura/stack_tecnologico_plan_implementacion.md)
* **Especificación de Requisitos (SRS):** [docs/requisitos/especificacion_requisitos.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/requisitos/especificacion_requisitos.md)
