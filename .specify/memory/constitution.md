# Constitución del Proyecto: Quantix (Comercio Inteligente)

**Versión:** 1.0.0  
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

### Artículo III: Segregación Estricta OLTP vs. OLAP
1. La base de datos operativa (**PostgreSQL 16**) se reserva exclusivamente para transacciones ACID de caja, inventario y autenticación. Queda estrictamente prohibido ejecutar consultas analíticas agregadas o reportes históricos sobre ella en producción.
2. Toda consulta analítica, dashboard o proyección de demanda debe ejecutarse contra el motor columnar embebido (**DuckDB**), alimentado asíncronamente por el pipeline ETL interno (`APScheduler`).

### Artículo IV: Cero Tolerancia a la Fuga de Valor
1. **Regla FEFO (*First Expired, First Out*):** El inventario perecedero se descarga obligatoriamente del lote con fecha de vencimiento más próxima.
2. **Arqueo Ciego:** Ninguna interfaz de cierre de caja debe mostrar al cajero el total teórico recaudado antes de registrar su declaración física.
3. **Inmutabilidad de Auditoría:** Toda anulación, descuento manual o apertura de cajón sin venta debe generar un registro inmutable `APPEND-ONLY`.

---

## 2. Stack Tecnológico Estandarizado

Para garantizar la velocidad de implementación (sprint de 48 horas) y minimizar fallos de compilación en agentes de IA:

* **Backend:** Python 3.11+ / FastAPI / Pydantic v2 / SQLAlchemy 2.0.
* **Base de Datos Operativa (OLTP):** PostgreSQL 16 (vía Docker Compose).
* **Base de Datos Analítica (OLAP):** DuckDB (archivo columnar embebido).
* **Orquestación ETL:** APScheduler embebido en FastAPI (alternativa ligera a Airflow).
* **Frontend:** React 18 / Vite / TypeScript / Tailwind CSS / Lucide React / Recharts.
* **Testing:** pytest (Backend) / Vitest + React Testing Library (Frontend).

---

## 3. Estructura Canónica de una Especificación (`specs/XXX-nombre/`)

Cada especificación en `specs/` debe contener estrictamente los siguientes artefactos:

| Archivo / Carpeta | Propósito |
| :--- | :--- |
| `spec.md` | Requisitos de negocio, historias de usuario y criterios de aceptación (Gherkin/Given-When-Then). |
| `plan.md` | Arquitectura técnica de la función, dependencias y riesgos. |
| `research.md` | Decisiones técnicas, alternativas descartadas y justificaciones. |
| `data-model.md` | Esquema relacional (OLTP) y/o dimensional (OLAP) impactado. |
| `contracts/` | Contratos de API (OpenAPI YAML o JSON schemas) que congelan los endpoints antes de codificar. |
| `tasks.md` | Lista granular de tareas ejecutables por agentes (checklist con orden de precedencia). |
| `quickstart.md` | Guía de pruebas rápidas (cURL, scripts o flujo de UI) para validar la spec. |

---

## 4. Reglas de Codificación y Control de Calidad

1. **Tipado Estricto:** Prohibido el uso de `Any` no justificado en Python y `any` en TypeScript.
2. **Idempotencia:** Todos los endpoints de cobro, actualización de stock y pipelines ETL deben ser idempotentes para evitar duplicaciones por reintentos de red.
3. **Manejo de Errores Semántico:** Las respuestas de error del API deben usar el estándar RFC 7807 (`application/problem+json`) o esquemas estructurados de error en Pydantic.
4. **Verificación Continua:** Cada tarea en `tasks.md` completada debe acompañarse de su prueba unitaria o de integración correspondiente en `/tests`.

---

## 5. Mapeo de Documentación Fundacional (`docs/`)

Todo agente de programación debe consultar los siguientes documentos fundacionales como fuentes canónicas de verdad antes de implementar o alterar cualquier especificación:

* **Estrategia Comercial:** [docs/negocio/estrategia_negocios.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/negocio/estrategia_negocios.md)
* **Marco Organizacional (Anthony):** [docs/negocio/analisis_organizacional.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/negocio/analisis_organizacional.md)
* **Diseño y Modelos de Datos (OLTP/OLAP):** [docs/arquitectura/diseno_arquitectura_datos.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/arquitectura/diseno_arquitectura_datos.md)
* **Stack y Plan de Implementación:** [docs/arquitectura/stack_tecnologico_plan_implementacion.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/arquitectura/stack_tecnologico_plan_implementacion.md)
* **Especificación de Requisitos (SRS):** [docs/requisitos/especificacion_requisitos.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/requisitos/especificacion_requisitos.md)
