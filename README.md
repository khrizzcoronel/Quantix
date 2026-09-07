# 🚀 Quantix: Smart POS & Business Intelligence

Bienvenido a **Quantix**, un sistema transaccional de Punto de Venta (POS) y Business Intelligence (BI) de próxima generación, construido con una arquitectura analítica híbrida (Medallion Architecture).

## 🧠 Arquitectura del Sistema
- **OLTP (Transaccional):** PostgreSQL + SQLAlchemy 2.0 (Motor asíncrono para concurrencia extrema).
- **OLAP (Analítico):** DuckDB (Motor Columnar) sincronizado mediante `postgres_scanner`.
- **Backend:** FastAPI (Python) + WebSockets + SMTP.
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + Zustand.

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

# Construir Base de Datos
alembic revision --autogenerate -m "Inicial"
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

| Rol | Correo (Usuario) | Contraseña | Vistas Permitidas |
| :--- | :--- | :--- | :--- |
| **Director** | `admin@quantix.local` | `Admin123!` | POS, Dashboard BI, Reportes |
| **Cajero** | `cajero@quantix.local` | `Caja123!` | Solo POS |

---

## 📦 Módulos Principales Implementados

*   **Módulo 001 (POS y Logística FEFO):** Descarga de inventario bloqueando lotes pesimísticamente y ordenándolos por fecha de caducidad.
*   **Módulo 002 (CRM):** Base de datos de clientes y validación de vigencia de Cupones de descuento.
*   **Módulo 006 (Arqueos):** Cierre ciego de cajas, cálculo teórico vs físico y tolerancia a descuadres ($5.00).
*   **Módulo 009 (ETL Medallion):** DuckDB absorbiendo datos de PostgreSQL cada 5 minutos usando `APScheduler`. (Capas Bronze, Silver y Gold).
*   **Módulo 010 (Seguridad):** Autenticación JWT, Hashing de contraseñas y Override (Pase de Supervisor).
*   **Módulo 011 (BI Estratégico Z/T):** Proyección inferencial de demanda. El sistema detecta la muestra ($n$) y usa la **Distribución Normal Z** ($n \ge 30$) o la **Distribución de Student T** ($n < 30$) para dar un rango seguro de inventario (95% de confianza).
*   **Módulo 012 (Notificaciones):** WebSockets para alertas en tiempo real y protocolo SMTP para envío de correos.

---
*Hecho con ⚡ por Google Antigravity.*
