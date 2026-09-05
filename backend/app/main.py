from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.etl.scheduler import start_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Acciones al iniciar el servidor
    scheduler = start_scheduler()
    yield
    # Acciones al apagar el servidor
    scheduler.shutdown()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="API Core Transaccional y Analítica",
    lifespan=lifespan
)

# Configuración estricta de CORS (Módulo 010)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """
    Endpoint de salud del sistema para monitoreo operativo.
    """
    return {"status": "ok", "service": settings.PROJECT_NAME, "version": settings.VERSION}

from app.api import pos, auth, caja, inventario, ws, analitica

# Integración de routers HTTP
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Auth"])
app.include_router(pos.router, prefix=f"{settings.API_V1_STR}/pos", tags=["POS"])
app.include_router(caja.router, prefix=f"{settings.API_V1_STR}/caja", tags=["Caja & Arqueos"])
app.include_router(inventario.router, prefix=f"{settings.API_V1_STR}/inventario", tags=["Inventario & Compras"])
app.include_router(analitica.router, prefix=f"{settings.API_V1_STR}/dashboard", tags=["Business Intelligence"])

# Integración de WebSockets (Sin prefijo de API v1 para aislar los protocolos)
app.include_router(ws.router, prefix="/ws/notificaciones", tags=["WebSockets"])
