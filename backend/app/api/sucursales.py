from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID

from app.db.oltp import get_db
from app.api.deps import get_current_user, RoleChecker
from app.models.usuarios import Usuario
from app.models.sucursal import Sucursal
from app.schemas.sucursal import SucursalCreate, SucursalUpdate, SucursalResponse

router = APIRouter()

@router.get("", response_model=List[SucursalResponse])
async def listar_sucursales(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Lista todas las sucursales del negocio.
    """
    result = await db.execute(select(Sucursal).order_by(Sucursal.es_matriz.desc(), Sucursal.nombre.asc()))
    return result.scalars().all()

@router.post("", response_model=SucursalResponse, status_code=status.HTTP_201_CREATED)
async def crear_sucursal(
    req: SucursalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(RoleChecker(['SUPERVISOR', 'DIRECTOR']))
):
    """
    Registra una nueva sucursal o almacén satélite.
    """
    codigo_sanit = req.codigo.strip().upper()
    existente = await db.execute(select(Sucursal).where(Sucursal.codigo == codigo_sanit))
    if existente.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Ya existe una sucursal con el código '{codigo_sanit}'")

    sucursal = Sucursal(
        codigo=codigo_sanit,
        nombre=req.nombre.strip(),
        direccion=req.direccion.strip() if req.direccion else None,
        telefono=req.telefono.strip() if req.telefono else None,
        es_matriz=req.es_matriz,
        activo=req.activo
    )
    db.add(sucursal)
    await db.commit()
    await db.refresh(sucursal)
    return sucursal

@router.put("/{id}", response_model=SucursalResponse)
async def actualizar_sucursal(
    id: UUID,
    req: SucursalUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(RoleChecker(['SUPERVISOR', 'DIRECTOR']))
):
    """
    Actualiza datos de una sucursal existente.
    """
    sucursal = await db.get(Sucursal, id)
    if not sucursal:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada")

    if req.nombre is not None:
        sucursal.nombre = req.nombre.strip()
    if req.direccion is not None:
        sucursal.direccion = req.direccion.strip() if req.direccion else None
    if req.telefono is not None:
        sucursal.telefono = req.telefono.strip() if req.telefono else None
    if req.activo is not None:
        sucursal.activo = req.activo

    await db.commit()
    await db.refresh(sucursal)
    return sucursal
