# Modelo de Datos: 013 - Soporte Multi-Sucursal y Terminales

**Módulo:** 013-multi-sucursal  
**Esquema:** Relacional OLTP (PostgreSQL)

---

## 1. DDL Relacional (OLTP — PostgreSQL)

```sql
-- Tabla de Sucursales (Alembic 0008)
CREATE TABLE sucursal (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo      VARCHAR(20) NOT NULL UNIQUE,
    nombre      VARCHAR(150) NOT NULL,
    direccion   VARCHAR(255),
    ciudad      VARCHAR(100),
    telefono    VARCHAR(30),
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    es_matriz   BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sucursal_codigo ON sucursal(codigo);
CREATE INDEX idx_sucursal_activo ON sucursal(activo);

-- Registro inmutable de la sede Matriz
INSERT INTO sucursal (id, codigo, nombre, ciudad, es_matriz, activo)
VALUES ('00000000-0000-0000-0000-000000000001', 'SUC-001', 'Sucursal Matriz', 'Quito', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Tabla de Terminales de Caja por Sucursal
CREATE TABLE terminal_caja (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo      VARCHAR(50) NOT NULL,
    sucursal_id UUID NOT NULL REFERENCES sucursal(id) ON DELETE CASCADE,
    nombre      VARCHAR(100) NOT NULL,
    activa      BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_terminal_sucursal_codigo UNIQUE (sucursal_id, codigo)
);

CREATE INDEX idx_terminal_caja_sucursal ON terminal_caja(sucursal_id);
```
