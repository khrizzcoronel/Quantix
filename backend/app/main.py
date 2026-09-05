from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="API Core Transaccional y Analítica"
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

from app.api import pos

# Aquí incluiremos los routers más adelante
# app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Auth"])
app.include_router(pos.router, prefix=f"{settings.API_V1_STR}/pos", tags=["POS"])
