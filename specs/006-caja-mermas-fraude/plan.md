# Plan de Implementación Técnica: 006 - Caja, Mermas y Detección de Fraude

**Módulo:** 006-caja-mermas-fraude  
**Objetivo:** Implementar el ciclo completo de sesión de caja con arqueo ciego, el registro forense de eventos de auditoría y el dashboard táctico de mermas y descuadres.

---

## 1. Arquitectura de Componentes

```mermaid
flowchart TD
    subgraph Frontend ["Frontend POS (React 18 + Vite)"]
        ArqueoUI["Pantalla de Arqueo Ciego (solo conteo físico)"]
        DashboardMermas["Dashboard RF-BI-01: Sesiones + Semáforo"]
    end

    subgraph Backend ["Backend FastAPI"]
        RouterCaja["/api/v1/caja/"]
        RouterAdmin["/api/v1/admin/caja/"]
        DiscrepanciaService["DiscrepanciaArqueoService"]
        NotificacionService["NotificacionSupervisorService"]
    end

    subgraph Storage ["Base de Datos PostgreSQL 16"]
        TableSesion["sesiones_caja"]
        TableArqueo["arqueos_caja"]
        TableAuditoria["auditoria_eventos (APPEND-ONLY)"]
    end

    subgraph OLAP ["DuckDB (Analytics)"]
        FactArqueos["FACT_ARQUEOS_MERMA"]
    end

    ArqueoUI -->|POST /api/v1/caja/sesiones/{id}/arqueo-ciego| DiscrepanciaService
    DiscrepanciaService -->|Calcula diferencia| TableArqueo
    DiscrepanciaService -->|abs(diferencia) > tolerancia| NotificacionService
    DiscrepanciaService -->|Registro forense| TableAuditoria
    TableArqueo -->|ETL nocturno| FactArqueos
    RouterAdmin -->|GET auditoria| TableAuditoria
    FactArqueos --> DashboardMermas
```

---

## 2. Fases de Implementación

### Fase 1: Ciclo de Sesión de Caja
- **Apertura:** `POST /api/v1/caja/sesiones/abrir` — registra el cajero, la terminal y el fondo inicial en efectivo.
- **Ventas:** durante la sesión, cada venta se asocia al `sesion_caja_id` activo en la terminal.
- **Cierre con arqueo ciego:** `POST /api/v1/caja/sesiones/{id}/arqueo-ciego` — el cajero ingresa solo `efectivo_contado` y `comprobantes_tarjeta`; el backend calcula:
  ```
  diferencia = total_teorico - (efectivo_contado + comprobantes_tarjeta + fondo_inicial)
  total_teorico = Σ ventas en efectivo + Σ ventas con tarjeta de la sesión
  ```

### Fase 2: Detección de Discrepancia y Notificación
- Si `abs(diferencia) > caja_tolerancia_descuadre` (clave en `CONFIGURACION`, default: 50.00 MXN), el servicio:
  1. Registra el evento en `AUDITORIA_EVENTO` con contexto forense completo.
  2. Notifica al Supervisor vía el sistema de notificaciones interno.

### Fase 3: Registro Forense APPEND-ONLY
- La tabla `auditoria_eventos` es estrictamente de solo inserción: no se permiten `UPDATE` ni `DELETE`.
- Cada registro incluye: `tipo_evento`, `usuario_id`, `venta_referencia_id`, `ip_terminal`, `detalle_json` (snapshot completo del contexto).
- Se aplica una restricción de nivel de base de datos (trigger `BEFORE UPDATE OR DELETE`) para garantizar la inmutabilidad.

### Fase 4: Dashboard Táctico RF-BI-01
- Tabla de sesiones de caja con columna `diferencia` y semáforo: verde si `abs(diferencia) <= tolerancia`, amarillo si entre 1× y 2× la tolerancia, rojo si supera 2×.
- ETL nocturno carga `FACT_ARQUEOS_MERMA` en DuckDB para análisis histórico de mermas.

---

## 3. Dependencias

| Módulo | Motivo |
|--------|--------|
| **001-core-ventas-inventario** | Provee la tabla `ventas` sobre la que se calcula el `total_teorico` de cada sesión. |
