from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from uuid import UUID

from app.db.oltp import get_db
from app.api.deps import get_current_user
from app.models.usuarios import Usuario
from app.models.ventas import Cliente, Cupon
from app.schemas.crm import ClienteCreate, ClienteResponse, ValidarCuponRequest, ValidarCuponResponse

router = APIRouter()

@router.post("/clientes", response_model=ClienteResponse, status_code=status.HTTP_201_CREATED)
async def registrar_cliente(
    req: ClienteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Registra un nuevo cliente en el sistema desde la caja o desde backoffice.
    Valida que el teléfono no exista previamente.
    """
    existente = await db.execute(select(Cliente).where(Cliente.telefono == req.telefono))
    if existente.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe un cliente con este número de teléfono")
        
    nuevo_cliente = Cliente(
        telefono=req.telefono,
        nombre=req.nombre,
        email=req.email,
        puntos_acumulados=0
    )
    
    db.add(nuevo_cliente)
    await db.commit()
    await db.refresh(nuevo_cliente)
    
    return nuevo_cliente


@router.get("/clientes/buscar/{telefono}", response_model=ClienteResponse)
async def buscar_cliente_por_telefono(
    telefono: str,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Búsqueda ágil de cliente en caja para asociarlo a una venta y ganar puntos.
    """
    result = await db.execute(select(Cliente).where(Cliente.telefono == telefono))
    cliente = result.scalar_one_or_none()
    
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
        
    return cliente


@router.post("/cupones/validar", response_model=ValidarCuponResponse)
async def validar_cupon(
    req: ValidarCuponRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Valida las reglas de negocio de un cupón de descuento antes de aplicarlo al carrito.
    """
    result = await db.execute(select(Cupon).where(Cupon.codigo == req.codigo))
    cupon = result.scalar_one_or_none()
    
    if not cupon:
        return ValidarCuponResponse(valido=False, mensaje="Cupón inexistente")
        
    # Validar estado
    if cupon.estado.name != 'EMITIDO':
        return ValidarCuponResponse(valido=False, mensaje=f"El cupón ya fue {cupon.estado.name.lower()}")
        
    # Validar vigencia temporal
    ahora = datetime.now(timezone.utc)
    if cupon.valido_hasta and cupon.valido_hasta.replace(tzinfo=timezone.utc) < ahora:
        # Aquí en un proceso en background podríamos cambiarlo a EXPIRADO automáticamente
        cupon.estado = 'EXPIRADO'
        await db.commit()
        return ValidarCuponResponse(valido=False, mensaje="El cupón ha expirado")
        
    if cupon.valido_desde and cupon.valido_desde.replace(tzinfo=timezone.utc) > ahora:
        return ValidarCuponResponse(valido=False, mensaje="El cupón aún no es válido para su uso")
        
    # El cupón es válido, devolvemos las métricas para que el POS calcule el descuento
    return ValidarCuponResponse(
        valido=True,
        mensaje="Cupón válido",
        tipo_descuento=cupon.descuento_tipo.name,
        valor_descuento=cupon.descuento_valor,
        cupon_id=cupon.id
    )
