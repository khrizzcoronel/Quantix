# Especificación de Requisitos de Software: Módulo 7 - Análisis Estadístico & Reportes Avanzados

**Proyecto:** Quantix Retail OS  
**Módulo:** 012 - Análisis Estadístico & Reportes Avanzados (/analisis)  
**Nivel Organizacional (Anthony):** Estratégico (C-Level & Supervisión)  
**Fecha de Publicación:** Septiembre 2026  
**Estándar de referencia:** Adaptado de IEEE 830 / ISO/IEC/IEEE 29148  

---

## 1. Visión General del Módulo

El módulo de **Análisis Estadístico & Reportes Avanzados** unifica en una sola superficie de trabajo la inteligencia analítica profunda (inferencia estadística, clasificación Pareto ABC, segmentación RFM, mapas de calor de estacionalidad y proyecciones de demanda) con un potente motor dinámico OLAP de construcción y exportación de reportes ad-hoc.

Opera de forma totalmente desacoplada de la base transaccional PostgreSQL mediante la arquitectura **Medallion ETL** y el motor columnar embebido **DuckDB Gold**, garantizando lecturas a escala masiva sin interferir con las operaciones concurrentes de cobro en punto de venta (POS).

---

## 2. Matriz de Control de Acceso (RBAC) y Aislamiento por Sucursal

| Perfil de Usuario | Nivel de Acceso | Alcance de Sucursales | Capacidades Específicas |
| :--- | :---: | :---: | :--- |
| **DIRECTOR** | Pleno | **Global (Multi-sucursal)** | Acceso irrestricto a métricas consolidadas de todas las sucursales o filtrado individual mediante selector interactivo. Creación y borrado de plantillas públicas y privadas. |
| **SUPERVISOR** | Acotado | **Sucursal Asignada** | Acceso a las analíticas y reportes restringido estrictamente a su sucursal (current_user.sucursal_id). Selector fijado y bloqueado con candado visual. Rechazo con HTTP 403 ante cualquier intento de fuga de información entre sucursales. |
| **CAJERO** | Ninguno | — | Sin visibilidad ni acceso a la ruta /analisis (HTTP 403). |
| **BODEGUERO** | Ninguno | — | Sin visibilidad ni acceso a la ruta /analisis (HTTP 403). |

---

## 3. Requisitos Funcionales (MoSCoW)

### 3.1 Submódulo 1: Análisis Estadístico Avanzado

| Código | Requisito Funcional | Prioridad | Criterios de Aceptación |
| :--- | :--- | :---: | :--- |
| **RF-REP-01** | KPIs Ejecutivos Multidimensionales | **MUST** | El sistema debe computar y exhibir en tarjetas comparativas: Ingresos Netos, Margen Bruto %, Ticket Promedio, Transacciones Totales, Clientes Únicos y Unidades Vendidas, calculando automáticamente la variación porcentual (+/- %) respecto al período inmediatamente anterior. |
| **RF-REP-02** | Tendencias Temporales Interactivas | **MUST** | El sistema debe proyectar gráficos de área y línea (Recharts) comparando Ingresos vs. Margen de Ganancia con selector interactivo de granularidad: Diario, Semanal y Mensual, soportando tooltips detallados y escalas proporcionales. |
| **RF-REP-03** | Matriz de Pareto ABC de Productos | **MUST** | El sistema debe clasificar automáticamente el catálogo según el principio de Pareto (80/20): Clase A (primer 80% de ingresos), Clase B (siguiente 15%) y Clase C (último 5%), mostrando barras visuales de contribución acumulada y badges de clase. |
| **RF-REP-04** | Segmentación Algorítmica RFM | **MUST** | El motor analítico debe clasificar a los clientes en 5 segmentos estratégicos (Campeones, Leales, Potenciales, En Riesgo, Inactivos) basados en Recencia (días sin compra), Frecuencia (visitas) y Valor Monetario (gasto acumulado), proveyendo recomendaciones comerciales por segmento. |
| **RF-REP-05** | Heatmap de Estacionalidad Comercial | **MUST** | El sistema debe generar una cuadrícula horaria y semanal (7 días × franjas de 08:00 a 22:00) con degradado térmico cromático para identificar picos de afluencia y apoyar la toma de decisiones de turnos y apertura de cajas. |
| **RF-REP-06** | Inferencia Estadística de Demanda Z/t | **MUST** | Para cada SKU con historial suficiente, el sistema debe evaluar el tamaño muestral (n) y seleccionar automáticamente la distribución Normal (Z para n >= 30) o Student-t (t para n < 30) con intervalo de confianza al 95%, proyectando stock preventivo y semáforo de riesgo de quiebre. |

### 3.2 Submódulo 2: Constructor Dinámico de Reportes & Plantillas

| Código | Requisito Funcional | Prioridad | Criterios de Aceptación |
| :--- | :--- | :---: | :--- |
| **RF-REP-07** | Catálogo de Columnas y Reordenamiento | **MUST** | El sistema debe ofrecer 15 columnas predeterminadas activas (Fecha, Folio, Sucursal, Cajero, Cliente, Categoría, Producto, Cantidad, P. Unitario, Subtotal, Descuento, IVA 16%, Total, Margen, Método de Pago) permitiendo activar/desactivar y reordenar su posición en la tabla. |
| **RF-REP-08** | Filtros Cruzados y Agrupación Dinámica | **MUST** | El usuario debe poder filtrar por rango de fechas, sucursal, categoría, método de pago y cajero, además de seleccionar el nivel de agregación: Detalle por línea, por Día, por Producto, por Categoría, por Cajero o por Método de Pago. |
| **RF-REP-09** | Fila Fija de Totales y Paginación | **MUST** | La tabla de resultados debe incluir ordenamiento por cabecera, paginación configurable (25, 50, 100 registros) y una fila inferior fija y destacada con los totales acumulados (unidades, subtotal, descuentos, impuestos, total facturado y margen). |
| **RF-REP-10** | Motor de Plantillas de Reporte Persistentes | **SHOULD** | El sistema debe proveer 4 plantillas de sistema de fábrica y permitir a los directores y supervisores memorizar configuraciones personalizadas con nombre descriptivo en PostgreSQL (plantillas_reporte), recuperándolas en un clic. |
| **RF-REP-11** | Exportación Multiformato Profesional | **MUST** | El sistema debe exportar los reportes generados a formato CSV (con codificación UTF-8 y BOM para apertura nativa en Microsoft Excel) y permitir impresión / guardado en PDF formal con membrete oficial de Quantix y estilos @media print. |

---

## 4. Arquitectura de Datos Subyacente

`
                [ PostgreSQL OLTP (Producción) ]
               ventas, detalles_venta, clientes,
               usuarios, sucursales, pagos_venta
                              │
                              ▼  (APScheduler / Medallion Pipeline)
                [ DuckDB Capa Bronze (Raw) ]
                              │
                              ▼  (Filtrado y Limpieza)
                [ DuckDB Capa Silver (Clean) ]
                              │
                              ▼  (Modelo Dimensional Kimball)
                [ DuckDB Capa Gold (Dimensional) ]
                  ├── gold.dim_tiempo
                  ├── gold.dim_producto
                  ├── gold.dim_cliente
                  ├── gold.dim_cajero
                  ├── gold.dim_sucursal
                  ├── gold.fact_ventas  (Granularidad Línea + Sucursal + Cajero)
                  └── gold.fact_pagos   (Trazabilidad por Método de Cobro)
                              │
                              ▼
        [ FastAPI Router: /api/v1/reportes ] ◄── Control RBAC
                              │
                              ▼
            [ Frontend React 19: Analisis.tsx ]
`

---

## 5. Endpoints de la API REST (/api/v1/reportes)

1. GET /api/v1/reportes/analisis/kpis-avanzados
   - Parámetros: echa_desde, echa_hasta, sucursal_id.
   - Salida: KpisAvanzadosResponse.
2. GET /api/v1/reportes/analisis/tendencias
   - Parámetros: periodicidad (DIA/SEMANA/MES), sucursal_id.
   - Salida: TendenciaAvanzadaResponse.
3. GET /api/v1/reportes/analisis/abc-productos
   - Parámetros: sucursal_id, limite.
   - Salida: AbcParetoResponse.
4. GET /api/v1/reportes/analisis/rfm-clientes
   - Parámetros: sucursal_id.
   - Salida: RfmAnalisisResponse.
5. GET /api/v1/reportes/analisis/estacionalidad
   - Parámetros: sucursal_id.
   - Salida: EstacionalidadResponse.
6. GET /api/v1/reportes/analisis/proyecciones
   - Parámetros: sucursal_id.
   - Salida: List[ProyeccionDemandaResponse].
7. GET /api/v1/reportes/columnas-disponibles
   - Salida: CatalogoColumnasResponse.
8. POST /api/v1/reportes/generar
   - Payload: GenerarReporteRequest (columnas, iltros, grupacion, orden, limite, offset).
   - Salida: ReporteGeneradoResponse.
9. GET /api/v1/reportes/plantillas | POST | DELETE /{id}
   - CRUD completo de plantillas de reporte con persistencia relacional en PostgreSQL.
