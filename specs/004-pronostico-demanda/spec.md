# Especificación Funcional: 004 - Pronóstico de Demanda, Inferencia Estadística y Reaprovisionamiento Inteligente

**Módulo:** 004-pronostico-demanda  
**Nivel Organizacional:** Táctico / Estratégico (DSS / EIS)  
**Estado:** IMPLEMENTADO / VERIFICADO  
**Dependencias:** 001-core-ventas-inventario, 003-precios-margenes  

---

## 1. Problema y Objetivos
El aprovisionamiento empírico en el retail provoca dos escenarios costosos: exceso de inventario con capital inmovilizado y riesgo de caducidad, o quiebres de stock recurrentes que generan ventas perdidas y degradan la experiencia del cliente.

Este módulo implementa el motor de inteligencia de reabastecimiento de Quantix:
* Sugerencias operativas de reorden automáticas basadas en la velocidad diaria de venta a 30 días, el tiempo de entrega del proveedor habitual (`lead_time_dias`) y stocks de seguridad calibrados por la clasificación ABC de Pareto del producto.
* Generación directa y en un clic de borradores de órdenes de compra precargadas con las cantidades sugeridas.
* Inferencia estadística de demanda sobre la capa analítica DuckDB Gold aplicando el Teorema del Límite Central con intervalos de confianza al 95%:
  - Selección dinámica de la **Distribución Normal (Z)** para muestras grandes ($n \ge 30$ días).
  - Selección de la **Distribución Student-t** con $n-1$ grados de libertad para muestras pequeñas ($n < 30$ días).
* Semáforo predictivo de riesgo de quiebre (`OPTIMO`, `ALERTA_REPOSICION`, `RIESGO_QUIEBRE`) para directores y supervisores.
* Mapa de calor de estacionalidad horaria y semanal ($7 \times 24$) para optimización de abastecimiento y personal de caja.

---

## 2. Historias de Usuario y Criterios de Aceptación

### Historia 1: Cálculo Operativo de Sugerencias de Reorden
* **Como** encargado de compras o bodega,  
* **Quiero** consultar la lista de productos bajo su punto de reorden con el proveedor y cantidades recomendadas,  
* **Para** emitir órdenes de compra oportunas antes de agotar existencias.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Producto con stock por debajo del punto de reorden
  Dado un producto "ARROZ-1KG" de Clase A (stock de seguridad = 15 unidades)
  Y un proveedor con lead_time_dias = 4
  Y una velocidad de venta en los últimos 30 días de 5 unidades/día
  Y un stock disponible actual de 25 unidades
  Cuando el sistema calcula el punto de reorden: ceil((5 * 4) + 15) = 35 unidades
  Entonces como 25 <= 35, el producto aparece en GET /inventario/ordenes-compra/sugerencias
  Y la cantidad sugerida de compra es ceil((35 * 2) - 25) = 45 unidades
  Y el motivo indica "Stock bajo (25.0/35.0 piezas)".
```

---

### Historia 2: Inferencia Predictiva Z y Student-t en DuckDB Gold
* **Como** director general,  
* **Quiero** conocer los intervalos de confianza al 95% de la demanda diaria proyectada para cada producto,  
* **Para** validar el stock de seguridad requerido con rigor estadístico.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Inferencia con muestra grande (Distribución Normal Z)
  Dado un producto con n = 45 días de ventas registradas
  Cuando el motor analítico procesa GET /api/v1/reportes/analisis/proyecciones
  Entonces utiliza la distribución Normal Z con factor Z = 1.96
  Y devuelve demanda_media_diaria, desviacion_estandar, limite_inferior_95, limite_superior_95 y stock_preventivo_sugerido.

Escenario: Inferencia con muestra pequeña (Distribución Student-t)
  Dado un producto nuevo o de baja rotación con n = 12 días de ventas registradas
  Cuando el motor analítico procesa las proyecciones
  Entonces utiliza la distribución Student-t con 11 grados de libertad (df = 11)
  Y calcula el intervalo al 95% reflejando mayor incertidumbre muestral.
```

---

### Historia 3: Mapa de Calor de Estacionalidad Horaria y Semanal
* **Como** supervisor de tienda,  
* **Quiero** analizar la concentración de transacciones por día de la semana y hora del día,  
* **Para** sincronizar la recepción de mercancía y la apertura de cajas en los picos de mayor demanda.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Consulta de la cuadrícula de estacionalidad 7x24
  Dado el histórico de ventas en DuckDB Gold
  Cuando se consulta GET /api/v1/reportes/analisis/estacionalidad
  Entonces el sistema devuelve una matriz de 7 días (Lunes a Domingo) por franjas de 08:00 a 22:00
  Y cada celda contiene el conteo de transacciones y el monto facturado, permitiendo su graficación como heatmap cromático.
```

---

## 3. Requisitos No Funcionales del Módulo
* **Calibración ABC de Stocks de Seguridad:**
  - Clase A (80% facturación): 15 unidades de margen de seguridad.
  - Clase B (15% facturación): 10 unidades de margen de seguridad.
  - Clase C (5% facturación): 5 unidades de margen de seguridad.
* **Aislamiento Multi-Sucursal:** Todas las métricas predictivas y sugerencias respetan el parámetro `sucursal_id`, permitiendo visión por tienda física o consolidada para dirección.
