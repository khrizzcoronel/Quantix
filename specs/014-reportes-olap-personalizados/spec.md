# Especificación Funcional: 014 - Constructor Dinámico de Reportes y Motor OLAP

**Módulo:** 014-reportes-olap-personalizados  
**Nivel Organizacional:** Estratégico y Táctico (MIS / EIS)  
**Estado:** IMPLEMENTADO / VERIFICADO  
**Dependencias:** 009-etl-medallion, 010-auth-usuarios, 013-multi-sucursal  
**Componentes Frontend:** `ReportePersonalizadoBuilder.tsx`, `ReportePreview.tsx`  
**Backend API:** `app/api/reportes.py`, `app/models/reportes.py`  

---

## 1. Declaración del Problema y Objetivos
Los reportes estáticos y prediseñados no satisfacen la variedad de preguntas de negocio que surgen en una operación comercial compleja. Los gerentes requieren autonomía para seleccionar campos específicos, aplicar filtros cruzados, agrupar transacciones por múltiples dimensiones y exportar la información formateada sin depender de requerimientos de desarrollo.

Este módulo implementa el motor de generación ad-hoc de reportes OLAP de Quantix:
* **Catálogo Flexible de 15 Columnas Analíticas:** Fecha, Folio de Ticket, Sucursal, Cajero, Cliente, Categoría, Producto, Cantidad, Precio Unitario, Subtotal, Descuento, Impuesto IVA 16%, Total Facturado, Margen de Ganancia, Método de Pago.
* **Activación, Desactivación y Reordenamiento:** Selector interactivo de columnas con interruptores y control de orden mediante arrastre o botones de posición.
* **Filtros Multidimensionales Cruzados:** Rango de fechas (`fecha_desde`, `fecha_hasta`), sucursal, cajero, categoría de producto y método de pago.
* **Agrupación Dinámica Multidimensional:** Capacidad de generar el reporte al nivel de detalle transaccional por línea, o consolidado por: Día, Producto, Categoría, Cajero, Sucursal o Método de Pago.
* **Renderizado con Fila Fija de Totales (`ReportePreview.tsx`):** Tabla paginada (25, 50, 100 registros por página) con fila inferior fija destacando la sumatoria de cantidades, subtotales, descuentos, impuestos, total neto y margen monetario.
* **Motor Persistente de Plantillas de Reporte (`plantillas_reporte`):** Almacenamiento relacional en PostgreSQL (Alembic 0010) de configuraciones personalizadas por usuario, distinguiendo plantillas públicas del sistema y privadas del usuario.
* **Exportación Profesional Multiformato:**
  - **CSV estructurado:** Con codificación UTF-8 y marca BOM (`\uFEFF`) para visualización inmediata y sin distorsión tipográfica en Microsoft Excel.
  - **PDF / Impresión formal:** Vista estilizada para impresión con membrete institucional de Quantix, fecha de emisión, filtros aplicados y formato de moneda.
* **Aislamiento RBAC de Sucursal:** Los supervisores solo pueden generar reportes de su sede asignada (`current_user.sucursal_id`); los directores pueden consolidar todas las sedes o filtrar por una específica.

---

## 2. Historias de Usuario y Criterios de Aceptación Verificados

### Historia 1: Construcción Dinámica y Vista Previa de Reporte Ad-Hoc
* **Como** gerente de tienda o director,  
* **Quiero** seleccionar columnas específicas y agrupar por categoría de producto en un rango de fechas,  
* **Para** analizar el desempeño comercial de cada familia de productos en segundos.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Generación de reporte ad-hoc agrupado por categoría
  Dado que el usuario accede a /analisis en la pestaña "Constructor de Reportes"
  Cuando selecciona las columnas [Categoria, Cantidad, Total, Margen]
  Y define agrupacion = "CATEGORIA" con rango del mes actual
  Y presiona "Generar Reporte"
  Entonces el endpoint POST /api/v1/reportes/generar consulta DuckDB Gold
  Y devuelve la tabla agregada con su fila fija de totales consolidada
  Y ReportePreview renderiza los datos paginados sin bloqueos de interfaz.
```

### Historia 2: Guardado y Reutilización de Plantillas Persistentes
* **Como** auditor operativo,  
* **Quiero** guardar mi configuración de reporte como una plantilla personalizada en la base de datos,  
* **Para** regenerar el mismo informe semanalmente con un solo clic.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Guardado de plantilla personalizada
  Dado una configuración de columnas y filtros seleccionada en el constructor
  Cuando el usuario hace clic en "Guardar Plantilla" y asigna el nombre "Auditoría Semanal de Margen"
  Entonces el backend inserta el registro en plantillas_reporte asociado a su usuario_id
  Y la plantilla aparece en el menú desplegable de plantillas guardadas
  Y se emite un toast SUCCESS confirmando la persistencia.
```

### Historia 3: Exportación en CSV con BOM para Microsoft Excel
* **Como** analista de datos,  
* **Quiero** exportar el reporte generado a un archivo CSV que abra correctamente en Excel sin problemas de tildes o caracteres especiales,  
* **Para** incorporar los datos a modelos financieros externos.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Exportación a CSV compatible
  Dado un reporte generado visible en ReportePreview
  Cuando el usuario presiona "Exportar a CSV"
  Entonces el sistema descarga un archivo .csv codificado en UTF-8 con prefijo BOM (\uFEFF)
  Y los valores numéricos y nombres con tildes se abren de forma nativa en Excel sin distorsión.
```

---

## 3. Requisitos No Funcionales del Módulo
* **Rendimiento OLAP:** El tiempo de generación del reporte debe ser $\le 500$ ms sobre DuckDB Gold para consultas de hasta 500,000 transacciones.
* **Seguridad y Alcance:** Los supervisores tienen bloqueada la generación de reportes que incluyan datos de sucursales ajenas; el backend aplica el filtro obligatorio antes de la ejecución de la consulta SQL.
