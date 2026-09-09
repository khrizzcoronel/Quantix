from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID

from app.db.oltp import get_db
from app.api.deps import get_current_user, RoleChecker
from app.models.usuarios import Usuario
from app.models.promociones import ReglaPromocion
from app.schemas.promociones import (
    ReglaPromocionCreate,
    ReglaPromocionUpdate,
    ReglaPromocionResponse,
    EvaluarCarritoRequest,
    EvaluarCarritoResponse,
)
from app.services.promociones_engine import evaluar_promociones_carrito

router = APIRouter()

cajero_o_superior = RoleChecker(["CAJERO", "BODEGUERO", "SUPERVISOR", "DIRECTOR"])
supervisor_o_director = RoleChecker(["SUPERVISOR", "DIRECTOR"])

def construir_regla_response(regla: ReglaPromocion) -> ReglaPromocionResponse:
    return ReglaPromocionResponse(
        id=regla.id,
        nombre=regla.nombre,
        tipo_regla=regla.tipo_regla,
        producto_disparador_id=regla.producto_disparador_id,
        producto_beneficio_id=regla.producto_beneficio_id,
        categoria_id=regla.categoria_id,
        descuento_tipo=regla.descuento_tipo,
        descuento_valor=regla.descuento_valor,
        cantidad_minima=regla.cantidad_minima,
        monto_minimo=regla.monto_minimo,
        activo=regla.activo,
        creado_en=regla.creado_en,
        producto_disparador_nombre=regla.producto_disparador.nombre if regla.producto_disparador else None,
        producto_beneficio_nombre=regla.producto_beneficio.nombre if regla.producto_beneficio else None,
        categoria_nombre=regla.categoria.nombre if regla.categoria else None,
    )

@router.get("/", response_model=List[ReglaPromocionResponse])
async def listar_reglas(
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo"),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(cajero_o_superior)
):
    """
    Listar reglas de promoción automáticas, opcionalmente filtrables por activas.
    """
    query = select(ReglaPromocion).options(
        selectinload(ReglaPromocion.producto_disparador),
        selectinload(ReglaPromocion.producto_beneficio),
        selectinload(ReglaPromocion.categoria),
    )
    if activo is not None:
        query = query.where(ReglaPromocion.activo == activo)
    query = query.order_by(ReglaPromocion.creado_en.desc())
    result = await db.execute(query)
    reglas = result.scalars().all()
    return [construir_regla_response(r) for r in reglas]

@router.get("/{regla_id}", response_model=ReglaPromocionResponse)
async def obtener_regla(
    regla_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(cajero_o_superior)
):
    """
    Obtiene una regla de promoción por ID.
    """
    query = select(ReglaPromocion).where(ReglaPromocion.id == regla_id).options(
        selectinload(ReglaPromocion.producto_disparador),
        selectinload(ReglaPromocion.producto_beneficio),
        selectinload(ReglaPromocion.categoria),
    )
    result = await db.execute(query)
    regla = result.scalar_one_or_none()
    if not regla:
        raise HTTPException(status_code=404, detail="Regla de promoción no encontrada")
    return construir_regla_response(regla)

@router.post("/", response_model=ReglaPromocionResponse, status_code=status.HTTP_201_CREATED)
async def crear_regla(
    req: ReglaPromocionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(supervisor_o_director)
):
    """
    Crea una nueva regla de promoción automática. Solo Director y Supervisor.
    """
    nueva_regla = ReglaPromocion(
        nombre=req.nombre,
        tipo_regla=req.tipo_regla,
        producto_disparador_id=req.producto_disparador_id,
        producto_beneficio_id=req.producto_beneficio_id,
        categoria_id=req.categoria_id,
        descuento_tipo=req.descuento_tipo,
        descuento_valor=req.descuento_valor,
        cantidad_minima=req.cantidad_minima,
        monto_minimo=req.monto_minimo,
        activo=req.activo
    )
    db.add(nueva_regla)
    await db.commit()
    await db.refresh(nueva_regla)

    # Recargar con relaciones
    query = select(ReglaPromocion).where(ReglaPromocion.id == nueva_regla.id).options(
        selectinload(ReglaPromocion.producto_disparador),
        selectinload(ReglaPromocion.producto_beneficio),
        selectinload(ReglaPromocion.categoria),
    )
    result = await db.execute(query)
    regla_cargada = result.scalar_one()
    return construir_regla_response(regla_cargada)

@router.put("/{regla_id}", response_model=ReglaPromocionResponse)
async def editar_regla(
    regla_id: UUID,
    req: ReglaPromocionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(supervisor_o_director)
):
    """
    Edita una regla de promoción existente. Solo Director y Supervisor.
    """
    query = select(ReglaPromocion).where(ReglaPromocion.id == regla_id).options(
        selectinload(ReglaPromocion.producto_disparador),
        selectinload(ReglaPromocion.producto_beneficio),
        selectinload(ReglaPromocion.categoria),
    )
    result = await db.execute(query)
    regla = result.scalar_one_or_none()
    if not regla:
        raise HTTPException(status_code=404, detail="Regla de promoción no encontrada")

    update_data = req.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(regla, field, value)

    await db.commit()
    await db.refresh(regla)

    result_reload = await db.execute(query)
    regla_actualizada = result_reload.scalar_one()
    return construir_regla_response(regla_actualizada)

@router.delete("/{regla_id}", response_model=ReglaPromocionResponse)
async def baja_logica_regla(
    regla_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(supervisor_o_director)
):
    """
    Baja lógica de una regla de promoción (activo = False). Solo Director y Supervisor.
    """
    query = select(ReglaPromocion).where(ReglaPromocion.id == regla_id).options(
        selectinload(ReglaPromocion.producto_disparador),
        selectinload(ReglaPromocion.producto_beneficio),
        selectinload(ReglaPromocion.categoria),
    )
    result = await db.execute(query)
    regla = result.scalar_one_or_none()
    if not regla:
        raise HTTPException(status_code=404, detail="Regla de promoción no encontrada")

    regla.activo = False
    await db.commit()
    await db.refresh(regla)

    return construir_regla_response(regla)

@router.post("/evaluar-carrito", response_model=EvaluarCarritoResponse)
async def evaluar_carrito_promociones(
    req: EvaluarCarritoRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(cajero_o_superior)
):
    """
    Evalúa los ítems del carrito contra las reglas activas de promoción (Combos, Volumen, Monto Mínimo)
    y retorna los descuentos aplicables garantizando un margen de ticket >= 0 (no vender a pérdida).
    """
    return await evaluar_promociones_carrito(items=req.items, db=db)
