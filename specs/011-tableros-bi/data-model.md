# Modelo de Datos: 011 - Tableros BI y Estadística

El módulo de tableros BI utiliza una arquitectura híbrida para la distribución de la información. Mientras que las métricas operativas en tiempo real consultan directamente PostgreSQL, los tableros tácticos y estratégicos se apoyan en la capa Gold de DuckDB, la cual es generada por el pipeline ETL.

## Tablas de la Capa Gold (DuckDB)

El análisis estratégico y táctico consulta principalmente las siguientes tablas pre-calculadas en DuckDB:

### 1. FACT_VENTAS
Contiene las transacciones de venta consolidadas.
- **Granularidad:** Nivel de ticket/línea de producto.
- **Uso:** Análisis de ventas, rotación de productos, y cálculo de desviaciones estándar en la demanda diaria.

### 2. DIM_PRODUCTO
Catálogo maestro de productos enriquecido con categorías, familias y atributos comerciales.
- **Uso:** Agrupación y segmentación de datos en los tableros, cruce con hechos de venta para análisis de rentabilidad.

### 3. Otras Tablas Relevantes
Dependiendo del análisis, se pueden incluir otras tablas como `FACT_INVENTARIO_DIARIO` o `FACT_ARQUEOS_MERMA` para tableros tácticos de caducidades o descuadres.

## Aplicación de Modelos Estadísticos
Al consultar la tabla `FACT_VENTAS`, el motor estadístico calcula métricas agregadas como la media y la desviación estándar de la demanda por producto ($n$ = días con registro de ventas). Esto permite aplicar la **Distribución Z** ($n \ge 30$) o la **Distribución T de Student** ($n < 30$) para proyecciones de demanda e inferencias sobre el stock de seguridad.
