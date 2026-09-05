# Plan de Implementación Técnica: 001 - Core de Ventas e Inventario

**Módulo:** 001-core-ventas-inventario  
**Objetivo:** Implementar los endpoints transaccionales del backend en FastAPI, modelos SQLAlchemy y componentes de UI del POS en React.

---

## 1. Arquitectura de Componentes

```mermaid
flowchart TD
    subgraph Frontend ["Frontend POS (React 18 + Vite)"]
        ScannerUI["Componente Buscador / Lector Barcode"]
        CartUI["Tabla de Carrito Reactivo"]
        CheckoutModal["Modal de Cobro & Confirmación"]
    end

    subgraph Backend ["Backend FastAPI"]
        RouterPOS["/api/v1/pos/"]
        RouterInv["/api/v1/inventario/"]
        ServiceCheckout["CheckoutService (Lógica FEFO y Transacciones)"]
    end

    subgraph Storage ["Base de Datos PostgreSQL 16"]
        TableProd["productos"]
        TableLote["lotes_inventario"]
        TableVenta["ventas & detalle_ventas"]
    end

    ScannerUI -->|GET /api/v1/pos/productos/{barcode}| RouterPOS
    CheckoutModal -->|POST /api/v1/pos/checkout| ServiceCheckout
    ServiceCheckout -->|SELECT ... FOR UPDATE| TableLote
    ServiceCheckout -->|INSERT / UPDATE| TableVenta
```

---

## 2. Fases de Implementación

### Fase 1: Capa de Persistencia (Modelos & Migraciones)
1. Definición de modelos SQLAlchemy: `Producto`, `Categoria`, `LoteInventario`, `Venta`, `DetalleVenta`.
2. Restricciones e índices:
   * Índice único en `productos.codigo_barras`.
   * Índice compuesto en `lotes_inventario(producto_id, fecha_vencimiento, cantidad_disponible)`.
3. Script inicial de semillas (*seed data*) con productos y lotes de prueba.

### Fase 2: Servicios de Dominio (Lógica FEFO y Checkout)
1. `InventarioService.obtener_lotes_fefo(producto_id, cantidad_solicitada)`:
   * Query ordenada por `fecha_vencimiento ASC` donde `cantidad_disponible > 0`.
   * Algoritmo de partición de cantidades entre múltiples lotes si es necesario.
2. `CheckoutService.procesar_venta(payload: VentaCreate)`:
   * Apertura de transacción con bloqueo de filas.
   * Reducción de existencias en lotes.
   * Generación de ticket con margen congelado (`costo_unitario_lote`).

### Fase 3: Exposición de API (FastAPI)
1. `GET /api/v1/pos/buscar-producto?q=...`
2. `POST /api/v1/pos/checkout`
3. `POST /api/v1/inventario/entradas` (registro de lotes)
4. `GET /api/v1/inventario/alertas-caducidad`

### Fase 4: Frontend POS (React + Tailwind)
1. Terminal de punto de venta enfocado en teclado (atajo `F2` para cobrar, `Esc` para cancelar).
2. Carrito de compras con actualización instantánea de totales.
