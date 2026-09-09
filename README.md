# 🚀 Quantix: Smart POS & Business Intelligence

Bienvenido a **Quantix**, un sistema transaccional de Punto de Venta (POS) y Business Intelligence (BI) de próxima generación, construido con una arquitectura analítica híbrida (Medallion Architecture).

## 🧠 Arquitectura del Sistema
- **OLTP (Transaccional):** PostgreSQL + SQLAlchemy 2.0 (Motor asíncrono para concurrencia extrema).
- **OLAP (Analítico):** DuckDB (Motor Columnar) sincronizado mediante `postgres_scanner`.
- **Backend:** FastAPI (Python) + WebSockets + SMTP.
- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS + Zustand.

---

## 🛠️ Requisitos Previos

Antes de encender Quantix, asegúrate de tener instalados:
1. **Docker Desktop** (Debe estar encendido para correr PostgreSQL).
2. **Node.js** (v18 o superior) para el Frontend.
3. **Python 3.11 o 3.12** *(Nota: Si usas versiones muy recientes como 3.14, necesitarás tener instalados los "Microsoft Visual C++ Build Tools" para compilar librerías asíncronas).*

---

## 🚀 Guía de Lanzamiento Rápido (Quickstart)

Sigue estos 4 pasos exactamente en este orden para levantar todo el ecosistema.

### 1. Variables de Entorno y Base de Datos
Primero, crea el archivo de configuración y levanta el contenedor de la base de datos:
```powershell
cd backend
cp .env.example .env
cd ..
# Asegúrate de tener Docker abierto antes de correr esto:
docker-compose up -d
```

### 2. Backend (FastAPI + Migraciones + Seed)
Abre una terminal y levanta el servidor backend. Esto también creará las tablas e inyectará los productos de prueba.
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1

# Instalar dependencias
pip install -r requirements.txt

# Aplicar el esquema versionado
alembic upgrade head

# Inyectar datos semilla (Usuarios, Lotes FEFO y Productos)
python -m app.seed

# Levantar el servidor
uvicorn app.main:app --reload
```
📍 *El backend estará disponible en: http://localhost:8000*
📍 *Documentación de la API (Swagger) en: http://localhost:8000/docs*

### 3. Frontend (React + Vite)
Abre **otra terminal** (dejando la del backend corriendo), y levanta la interfaz visual:
```powershell
cd frontend
npm install
npm run dev
```
📍 *El frontend estará disponible en: http://localhost:5173*

---

## 🔑 Credenciales por Defecto (Datos Semilla)

Al ejecutar `app.seed`, el sistema se pobló con los siguientes usuarios de prueba:

| Rol | Correo (Usuario) | Contraseña | Vista Inicial / Acceso |
| :--- | :--- | :--- | :--- |
| **Director** | `admin@quantix.local` | `Admin123!` | `/dashboard` (BI Estratégico, Monitor Táctico, Inventario, POS) |
| **Supervisor** | `supervisor@quantix.local` | `Super123!` | `/tactico` (Semáforo Arqueos, Alertas FEFO, Auditoría, POS) |
| **Bodeguero** | `bodeguero@quantix.local` | `Bodega123!` | `/inventario` (Catálogo, Recepción de Mercancía y Lotes) |
| **Cajero** | `cajero@quantix.local` | `Caja123!` | `/pos` (Caja Registradora, Apertura y Arqueo Ciego) |

---

## 📦 Estado real de los módulos

| Área | Estado actual |
| :--- | :--- |
| POS, sesiones y logística FEFO | Implementado. Checkout transaccional, bloqueo pesimista, rechazo de lotes vencidos, IVA e idempotencia. |
| CRM, cupones y promociones | Implementado parcialmente. CRUD, validación y canje disponibles; RFM/LTV completo sigue pendiente. |
| Caja, arqueo y auditoría | Implementado. Los fallos ya no generan sesiones o arqueos simulados. |
| Pagos | Pasarela simulada con intentos persistentes, idempotencia y conciliación auditada de timeouts. Integración bancaria real fuera de alcance actual. |
| ETL Medallion | Implementación base Bronze/Silver/Gold con APScheduler; el modelo dimensional extendido sigue pendiente. |
| BI | Endpoint estratégico y frontend conectados a datos reales. No se muestran datos ficticios cuando Gold está vacío. |
| Notificaciones | WebSocket autenticado por JWT y servicio SMTP. Envío automático del ticket por correo sigue pendiente. |
| Offline-first | Pendiente. Un error de red conserva el carrito y no se presenta como venta exitosa. |
| Multi-sucursal | Especificado, todavía no implementado. |

El detalle requisito por requisito se mantiene en `docs/requisitos/analisis_cobertura_requerimientos.md`.

## ✅ Verificación

```powershell
# Con PostgreSQL levantado en Docker
docker compose up -d db

# Backend: unitarias e integración
.\backend\venv\Scripts\python.exe -m pytest tests backend\tests -q

# Frontend
cd frontend
npm run lint
npm run build
```

Las pruebas usan exclusivamente la base `quantix_test`. El frontend no incorpora datos de demostración como fallback: una API vacía produce un estado vacío y una API no disponible produce un error visible.

---
*Hecho con ⚡ por Google Antigravity.*
