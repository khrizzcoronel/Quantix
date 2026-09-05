# Modelo de Datos: 005 - Promociones Inteligentes

**Módulo:** 005-promociones-inteligentes  
**Esquema:** Relacional OLTP (PostgreSQL)

---

## 1. DDL Relacional (OLTP — PostgreSQL)

### Nueva tabla `reglas_promocion`

```sql
CREATE TABLE reglas_promocion (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre                  VARCHAR(150) NOT NULL,
    producto_trigger_id     UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    -- SKU que, al estar en el carrito, activa la regla (típicamente GANCHO)
    producto_objetivo_id    UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    -- SKU sobre el que se aplica el descuento (típicamente NICHO)
    descuento_valor         NUMERIC(10, 2) NOT NULL CHECK (descuento_valor > 0),
    descuento_tipo          descuento_tipo_enum NOT NULL,   -- PORCENTAJE o MONTO_FIJO (reutiliza ENUM de 002)
    activo                  BOOLEAN NOT NULL DEFAULT TRUE,
    valido_desde            DATE NOT NULL,
    valido_hasta            DATE,                           -- NULL = sin fecha de expiración
    creado_por_usuario_id   UUID NOT NULL,
    creado_en               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_regla_vigencia CHECK (valido_hasta IS NULL OR valido_hasta >= valido_desde),
    CONSTRAINT chk_trigger_distinto_objetivo CHECK (producto_trigger_id <> producto_objetivo_id)
);

CREATE INDEX idx_reglas_promo_trigger  ON reglas_promocion(producto_trigger_id) WHERE activo = TRUE;
CREATE INDEX idx_reglas_promo_objetivo ON reglas_promocion(producto_objetivo_id) WHERE activo = TRUE;
CREATE INDEX idx_reglas_promo_vigencia ON reglas_promocion(valido_desde, valido_hasta)  WHERE activo = TRUE;
```

### Parámetros de Configuración relacionados

```sql
-- Claves en la tabla CONFIGURACION (definida en 001) usadas por este módulo:
INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('fefo_alerta_dias_1',  '7',    'Días antes del vencimiento en que se activa el descuento de liquidación.'),
  ('fefo_descuento_pct',  '20.0', 'Porcentaje de descuento aplicado automáticamente en liquidación FEFO.');
```
