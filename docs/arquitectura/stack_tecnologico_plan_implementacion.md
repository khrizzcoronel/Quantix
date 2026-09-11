# Stack Tecnológico y Arquitectura de Implementación

**Proyecto:** Quantix Retail OS  
**Estado:** Producción / Verificado  
**Versión:** 2.0 (Alineación Integral Multi-Sede, Notificaciones Toasts y Logística)  
**Fecha:** Septiembre 2026  
**Documentos vinculados:**
* [estrategia_negocios.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/negocio/estrategia_negocios.md)
* [analisis_organizacional.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/negocio/analisis_organizacional.md)
* [diseno_arquitectura_datos.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/arquitectura/diseno_arquitectura_datos.md)
* [especificacion_requisitos.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/requisitos/especificacion_requisitos.md)

---

## 1. Selección Justificada del Stack

### 1.1 Backend & API
* **Tecnología:** **Python 3.11+ / FastAPI**
* **ORM & Migraciones:** **SQLAlchemy 2.0 + Alembic** (migraciones 0001 a 0011) + **Pydantic v2**
* **Justificación:**
  - Desempeño asíncrono nativo para operaciones de caja de baja latencia (< 200 ms).
  - Auto-documentación OpenAPI 3.0 interactiva (`/docs`).
  - Evolución controlada y versionada del esquema de base de datos mediante migraciones Alembic deterministas.

### 1.2 Base de Datos Operativa (OLTP)
* **Tecnología:** **PostgreSQL 16**
* **Justificación:**
  - Consistencia ACID estricta para arqueos ciegos, inventario FEFO y checkout multi-pago.
  - Aislamiento multi-sede nativo mediante claves foráneas a `sucursal(id)`.

### 1.3 Base de Datos Analítica (OLAP)
* **Tecnología:** **DuckDB** (`quantix_analytics.duckdb`)
* **Justificación:**
  - Motor columnar embebido de alto rendimiento que elimina la sobrecarga de almacenes externos.
  - Conector nativo `postgres_scanner` para ingestión de alta velocidad sin serializaciones intermedias.
  - Ejecución de agregaciones masivas para Pareto ABC, segmentación RFM e inferencia Z/t en < 100 ms.

### 1.4 Orquestación del Pipeline ETL
* **Tecnología:** **APScheduler (Python AsyncIOScheduler)** embebido en FastAPI.
* **Justificación:**
  - Micro-lotes cada 5 min y alertas predictivas cada 15 min sin requerir la pesada infraestructura de Apache Airflow.
  - Reprogramación en caliente y disparo manual auditado con persistencia en `etl_log`.

### 1.5 Frontend
* **Tecnología:** **React 19 + Vite 8 + TypeScript 5/6 + Tailwind CSS v4 + Zustand 5 + Recharts + Lucide React**
* **Justificación:**
  - **React 19 & Vite:** Renderizado ultrarrápido y Hot Module Replacement (HMR) instantáneo.
  - **Zustand 5 Multi-Store:** Manejo desacoplado y reactivo de estado global (`useSucursalStore`, `useAuthStore`, `useCajaStore`, `usePosStore`, `useNotificationStore`, `connectivityStore`).
  - **Sistema Unificado de Toasts:** Componente flotante `ToastContainer.tsx` en `Layout.tsx` (`top-20 right-6 z-50`) con auto-descarte y pausa al hover. Erradicación de banners locales redundantes.
  - **Offline-First:** Persistencia en IndexedDB nativo (`quantix_offline_db` v1) y coordinación entre pestañas con Web Locks API (`quantix_sync_lock`).

---

## 2. Estructura Real del Repositorio

```
Quantix/
├── docker-compose.yml                      # PostgreSQL 16
├── specs/                                  # Especificaciones formales (001 a 016)
│   ├── 001-core-ventas-inventario/
│   ├── 002-clientes-fidelizacion/
│   ├── 003-precios-margenes/
│   ├── 004-pronostico-demanda/
│   ├── 005-promociones-inteligentes/
│   ├── 006-caja-mermas-fraude/
│   ├── 007-pagos-seguridad/
│   ├── 008-offline-sync/
│   ├── 009-etl-medallion/
│   ├── 010-auth-usuarios/
│   ├── 011-tableros-bi/
│   ├── 012-notificaciones/
│   ├── 013-multi-sucursal/
│   ├── 014-reportes-olap-personalizados/  # (Nuevo) Constructor OLAP
│   ├── 015-transferencias-stock-multisede/# (Nuevo) Logística inter-sucursal
│   └── 016-validacion-sanitizacion-formularios/ # (Nuevo) Gobernanza y Módulo 10
│
├── backend/
│   ├── alembic/versions/                   # Migraciones 0001 a 0011
│   │   ├── 0001_baseline_schema.py
│   │   ├── 0002_add_checkout_idempotency.py
│   │   ├── 0003_payment_attempts.py
│   │   ├── 0004_offline_sync.py
│   │   ├── 0005_add_usuario_telefono.py
│   │   ├── 0006_orden_compra_recepcion_parcial.py
│   │   ├── 0007_movimientos_caja.py
│   │   ├── 0008_multi_sucursal.py
│   │   ├── 0009_add_cliente_cedula.py
│   │   ├── 0010_add_plantillas_reporte.py
│   │   └── 0011_add_sucursal_to_clientes_cupones.py
│   ├── app/
│   │   ├── api/                            # 18 Routers REST y WebSockets
│   │   │   ├── analitica.py, auth.py, caja.py, clientes.py, configuracion.py
│   │   │   ├── inventario.py, operaciones.py, pagos.py, pos.py, promociones.py
│   │   │   ├── reportes.py, sucursales.py, sync.py, transferencias.py, usuarios.py, ws.py
│   │   ├── models/                         # Modelos ORM SQLAlchemy
│   │   │   ├── sucursal.py, usuarios.py, ventas.py, inventario.py, reportes.py
│   │   │   ├── sync.py, pagos.py, promociones.py, operaciones.py, configuracion.py
│   │   ├── services/                       # Lógica de negocio (EmailSender, Pasarela, Promociones)
│   │   └── etl/                            # Pipeline Medallion y APScheduler
│   └── tests/                              # 95+ pruebas pytest
│
├── frontend/
│   ├── src/
│   │   ├── pages/                          # 10 Vistas Principales
│   │   │   ├── Analisis.tsx, Clientes.tsx, Configuracion.tsx, Dashboard.tsx
│   │   │   ├── Inventario.tsx, Login.tsx, Operaciones.tsx, POS.tsx, Tactico.tsx, Usuarios.tsx
│   │   ├── components/                     # Modales y Componentes UI
│   │   │   ├── ToastContainer.tsx          # Único contenedor global de notificaciones
│   │   │   ├── AperturaCajaModal.tsx, ArqueoCiegoModal.tsx, CorteXModal.tsx
│   │   │   ├── MovimientoCajaModal.tsx, MiActividadModal.tsx, PerfilUsuarioModal.tsx
│   │   │   ├── OrdenCompraModal.tsx, SimuladorPagoModal.tsx, TicketModal.tsx
│   │   │   ├── TransferenciaModal.tsx, TransferenciaDetalleModal.tsx
│   │   │   ├── ReportePersonalizadoBuilder.tsx, ReportePreview.tsx, NotificationCenter.tsx
│   │   ├── store/                          # Stores Zustand reactivos
│   │   │   ├── authStore.ts, cajaStore.ts, connectivityStore.ts
│   │   │   ├── posStore.ts, sucursalStore.ts, themeStore.ts
│   │   ├── hooks/                          # Custom Hooks
│   │   │   ├── useWebSocket.ts (helper mostrarToast), useFormValidation.ts
│   │   ├── utils/                          # Utilidades
│   │   │   ├── validation.ts (Módulo 10, EAN-13), exportUtils.ts
│   │   └── services/offline/               # Worker de sincronización e IndexedDB
│   └── tests/                              # 59 pruebas vitest
│
└── docs/                                   # Documentación técnica, negocio y arquitectura
```
