# Modelo de Datos: 005 - Promociones Inteligentes y Venta Cruzada

**Módulo:** 005-promociones-inteligentes  
**Esquema:** Relacional OLTP (PostgreSQL)

---

## 1. DDL Relacional (OLTP — PostgreSQL)

```sql
-- Tipos ENUM para Reglas de Promoción
CREATE TYPE tipo_regla_promocion_enum AS ENUM (
    'COMBO',
    'VOLUMEN',
    'MONTO_MINIMO'
);

CREATE TYPE descuento_regla_tipo_enum AS ENUM (
    'PORCENTAJE',
    'MONTO_FIJO'
);

-- Tabla de Reglas Promocionales
CREATE TABLE regla_promocion (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre                  VARCHAR(150) NOT NULL,
    tipo_regla              tipo_regla_promocion_enum NOT NULL,
    producto_disparador_id  UUID REFERENCES producto(id) ON DELETE SET NULL,
    producto_beneficio_id   UUID REFERENCES producto(id) ON DELETE SET NULL,
    categoria_id            UUID REFERENCES categoria(id) ON DELETE SET NULL,
    cantidad_minima         NUMERIC(10, 2) NOT NULL DEFAULT 1.00 CHECK (cantidad_minima >= 0),
    monto_minimo            NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (monto_minimo >= 0),
    descuento_tipo          descuento_regla_tipo_enum NOT NULL,
    descuento_valor         NUMERIC(10, 2) NOT NULL CHECK (descuento_valor > 0),
    activo                  BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_regla_promocion_activo     ON regla_promocion(activo);
CREATE INDEX idx_regla_promocion_tipo       ON regla_promocion(tipo_regla);
CREATE INDEX idx_regla_promocion_disparador ON regla_promocion(producto_disparador_id);
CREATE INDEX idx_regla_promocion_beneficio  ON regla_promocion(producto_beneficio_id);
CREATE INDEX idx_regla_promocion_categoria  ON regla_promocion(categoria_id);
```

---

## 2. Esquema de Evaluación en Memoria (`evaluar_promociones_carrito`)

El motor recibe la lista de productos del carrito y ejecuta:

```python
class ResultadoPromocionAplicada(BaseModel):
    regla_id: UUID
    nombre_regla: str
    tipo_regla: str
    descuento_aplicado: Decimal
    producto_afectado_id: Optional[UUID] = None

class EvaluacionCarritoResponse(BaseModel):
    descuento_total: Decimal
    subtotal_bruto: Decimal
    total_con_descuento: Decimal
    promociones_aplicadas: List[ResultadoPromocionAplicada]
    margen_respetado: bool
```
