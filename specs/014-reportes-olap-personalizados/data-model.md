# Modelo de Datos: 014 - Constructor Dinámico de Reportes y Motor OLAP

**Módulo:** 014-reportes-olap-personalizados  
**Esquema:** Relacional OLTP (PostgreSQL) + Motor Analítico (DuckDB Gold)

---

## 1. DDL Relacional (OLTP — PostgreSQL)

```sql
-- Tabla de Plantillas Persistentes de Reporte (Alembic 0010)
CREATE TABLE plantillas_reporte (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id              UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    sucursal_id             UUID REFERENCES sucursal(id) ON DELETE CASCADE,
    nombre                  VARCHAR(150) NOT NULL,
    descripcion             TEXT,
    columnas_seleccionadas  JSONB NOT NULL,
    filtros_defecto         JSONB,
    agrupacion_defecto      VARCHAR(50) NOT NULL DEFAULT 'LINEA',
    es_publica              BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_plantillas_reporte_usuario  ON plantillas_reporte(usuario_id);
CREATE INDEX idx_plantillas_reporte_sucursal ON plantillas_reporte(sucursal_id);
CREATE INDEX idx_plantillas_reporte_publica  ON plantillas_reporte(es_publica);
```

---

## 2. Catálogo Oficial de 15 Columnas Analíticas OLAP

| ID Columna | Etiqueta en Interfaz | Tipo de Dato | Origen en DuckDB Gold | Agregable por Defecto |
| :--- | :--- | :--- | :--- | :---: |
| `fecha` | Fecha y Hora | Date / Time | `v.fecha_hora` | No |
| `folio_ticket` | Folio de Ticket | Monospace | `v.folio_ticket` | No |
| `sucursal` | Sucursal | Texto | `s.nombre` | No |
| `cajero` | Cajero en Turno | Texto | `u.nombre_completo` | No |
| `cliente` | Cliente | Texto | `c.nombre` | No |
| `categoria` | Categoría | Texto | `p.categoria` | Sí |
| `producto` | Producto (SKU/Nombre)| Texto | `p.nombre` | Sí |
| `cantidad` | Unidades Vendidas | Numérico (3 dec.) | `v.cantidad` | **SUM** |
| `precio_unitario` | Precio Unitario | Moneda ($) | `v.precio_unitario` | **AVG** |
| `subtotal` | Subtotal Bruto | Moneda ($) | `v.subtotal` | **SUM** |
| `descuento` | Descuento Aplicado | Moneda ($) | `v.descuento` | **SUM** |
| `impuesto` | IVA Trasladado 16% | Moneda ($) | `v.impuesto` | **SUM** |
| `total` | Total Facturado | Moneda ($) | `v.total_linea` | **SUM** |
| `margen` | Margen Bruto ($) | Moneda ($) | `v.margen_ganancia`| **SUM** |
| `metodo_pago` | Método de Cobro | Badge Semántico | `pago.metodo_pago` | Sí |
