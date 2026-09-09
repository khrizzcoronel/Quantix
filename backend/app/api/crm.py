from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from uuid import UUID

from app.db.oltp import get_db
from app.api.deps import get_current_user, RoleChecker
from app.models.usuarios import Usuario
from app.models.ventas import Cliente, Cupon, Venta, EstadoCupon, TipoCupon, DescuentoTipo
from app.schemas.crm import (
    ClienteCreate, ClienteUpdate, ClienteResponse, 
    ValidarCuponRequest, ValidarCuponResponse,
    CuponCreate, CuponResponse, HistorialVentaClienteResponse
)

router = APIRouter()

cajero_o_superior = RoleChecker(["CAJERO", "BODEGUERO", "SUPERVISOR", "DIRECTOR"])
supervisor_o_director = RoleChecker(["SUPERVISOR", "DIRECTOR"])

@router.get("/clientes", response_model=List[ClienteResponse])
async def listar_clientes(
    activo_only: bool = Query(False, description="Filtrar solo clientes activos"),
    q: Optional[str] = Query(None, description="Búsqueda por teléfono o nombre"),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Listado general de clientes registrados con opción de búsqueda y filtro de activos.
    """
    query = select(Cliente)
    if activo_only:
        query = query.where(Cliente.activo == True)
    if q:
        termino = f"%{q.strip()}%"
        query = query.where(
            or_(
                Cliente.nombre.ilike(termino),
                Cliente.telefono.ilike(termino),
                Cliente.cedula.ilike(termino)
            )
        )
    query = query.order_by(Cliente.nombre.asc())
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/clientes", response_model=ClienteResponse, status_code=status.HTTP_201_CREATED)
async def registrar_cliente(
    req: ClienteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Registra un nuevo cliente en el sistema desde la caja o desde backoffice.
    Valida que la cédula y el teléfono no existan previamente.
    """
    cedula_limpia = req.cedula.strip() if (req.cedula and req.cedula.strip()) else None
    tel_limpio = req.telefono.strip()

    if cedula_limpia:
        existente_ced = await db.execute(select(Cliente).where(Cliente.cedula == cedula_limpia))
        if existente_ced.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Ya existe un cliente con esta cédula de identidad")

    existente_tel = await db.execute(select(Cliente).where(Cliente.telefono == tel_limpio))
    if existente_tel.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe un cliente con este número de celular/teléfono")
        
    nuevo_cliente = Cliente(
        cedula=cedula_limpia,
        telefono=tel_limpio,
        nombre=req.nombre.strip(),
        email=req.email.strip() if req.email else None,
        puntos_acumulados=0,
        activo=True
    )
    
    db.add(nuevo_cliente)
    await db.commit()
    await db.refresh(nuevo_cliente)
    
    return nuevo_cliente

@router.get("/clientes/buscar/{identificador}", response_model=ClienteResponse)
async def buscar_cliente_por_identificador(
    identificador: str,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Búsqueda ágil de cliente en caja por Cédula o Teléfono celular para asociarlo a una venta.
    """
    id_limpio = identificador.strip()
    result = await db.execute(
        select(Cliente).where(
            or_(
                Cliente.cedula == id_limpio,
                Cliente.telefono == id_limpio
            )
        )
    )
    cliente = result.scalar_one_or_none()
    
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado por cédula ni teléfono")
        
    return cliente

@router.get("/clientes/{cliente_id}", response_model=ClienteResponse)
async def obtener_cliente(
    cliente_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    cliente = await db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return cliente

@router.put("/clientes/{cliente_id}", response_model=ClienteResponse)
async def actualizar_cliente(
    cliente_id: UUID,
    req: ClienteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Actualiza la información del cliente.
    """
    cliente = await db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
        
    if req.cedula is not None:
        c_limpia = req.cedula.strip() if req.cedula.strip() else None
        if c_limpia:
            dup_ced = await db.execute(
                select(Cliente).where(Cliente.cedula == c_limpia, Cliente.id != cliente_id)
            )
            if dup_ced.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Ya existe otro cliente con esta cédula")
        cliente.cedula = c_limpia

    if req.telefono is not None:
        t_limpio = req.telefono.strip()
        duplicado = await db.execute(
            select(Cliente).where(Cliente.telefono == t_limpio, Cliente.id != cliente_id)
        )
        if duplicado.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Ya existe otro cliente con este teléfono")
        cliente.telefono = t_limpio
        
    if req.nombre is not None:
        cliente.nombre = req.nombre.strip()
    if req.email is not None:
        cliente.email = req.email.strip() if req.email else None
    if req.puntos_acumulados is not None:
        cliente.puntos_acumulados = req.puntos_acumulados
    if req.activo is not None:
        cliente.activo = req.activo
        
    await db.commit()
    await db.refresh(cliente)
    return cliente

@router.delete("/clientes/{cliente_id}", response_model=ClienteResponse)
async def baja_logica_cliente(
    cliente_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(supervisor_o_director)
):
    """
    Baja lógica de cliente (desactiva al cliente sin borrar historial de compras).
    """
    cliente = await db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
        
    cliente.activo = False
    await db.commit()
    await db.refresh(cliente)
    return cliente

@router.get("/clientes/{cliente_id}/historial", response_model=List[HistorialVentaClienteResponse])
async def obtener_historial_cliente(
    cliente_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Retorna el historial de tickets/compras de un cliente.
    """
    cliente = await db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
        
    query = (
        select(Venta)
        .where(Venta.cliente_id == cliente_id)
        .order_by(Venta.fecha_hora.desc())
        .limit(50)
    )
    result = await db.execute(query)
    ventas = result.scalars().all()
    
    return [
        HistorialVentaClienteResponse(
            id=v.id,
            folio_ticket=v.folio_ticket,
            fecha_hora=v.fecha_hora,
            total_bruto=v.total_bruto,
            total_descuento=v.total_descuento,
            total_pagar=v.total_pagar,
            estado=v.estado.value if hasattr(v.estado, 'value') else str(v.estado)
        )
        for v in ventas
    ]

# ----------------- CUPONES -----------------

@router.get("/cupones", response_model=List[CuponResponse])
async def listar_cupones(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Lista todos los cupones emitidos en el sistema.
    """
    query = (
        select(Cupon, Cliente.nombre.label("cliente_nombre"))
        .join(Cliente, Cupon.cliente_id == Cliente.id)
        .order_by(Cupon.creado_en.desc())
    )
    result = await db.execute(query)
    rows = result.all()
    
    resp = []
    for c, c_nom in rows:
        resp.append(
            CuponResponse(
                id=c.id,
                cliente_id=c.cliente_id,
                cliente_nombre=c_nom,
                codigo=c.codigo,
                tipo=c.tipo.value if hasattr(c.tipo, 'value') else str(c.tipo),
                descuento_tipo=c.descuento_tipo.value if hasattr(c.descuento_tipo, 'value') else str(c.descuento_tipo),
                descuento_valor=c.descuento_valor,
                valido_desde=c.valido_desde,
                valido_hasta=c.valido_hasta,
                estado=c.estado.value if hasattr(c.estado, 'value') else str(c.estado),
                creado_en=c.creado_en
            )
        )
    return resp

@router.post("/cupones", response_model=CuponResponse, status_code=status.HTTP_201_CREATED)
async def crear_cupon(
    req: CuponCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(supervisor_o_director)
):
    """
    Crea un nuevo cupón asignado a un cliente.
    """
    cliente = await db.get(Cliente, req.cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente asignado no existe")
        
    existente = await db.execute(select(Cupon).where(Cupon.codigo == req.codigo.strip().upper()))
    if existente.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe un cupón con este código")
        
    ahora = datetime.now()
    val_desde = req.valido_desde or ahora.date()
    val_hasta = req.valido_hasta or (ahora + timedelta(days=30)).date()
    
    nuevo_cupon = Cupon(
        cliente_id=req.cliente_id,
        codigo=req.codigo.strip().upper(),
        tipo=req.tipo,
        descuento_tipo=req.descuento_tipo,
        descuento_valor=req.descuento_valor,
        valido_desde=val_desde,
        valido_hasta=val_hasta,
        estado=EstadoCupon.EMITIDO
    )
    db.add(nuevo_cupon)
    await db.commit()
    await db.refresh(nuevo_cupon)
    
    return CuponResponse(
        id=nuevo_cupon.id,
        cliente_id=nuevo_cupon.cliente_id,
        cliente_nombre=cliente.nombre,
        codigo=nuevo_cupon.codigo,
        tipo=nuevo_cupon.tipo.value if hasattr(nuevo_cupon.tipo, 'value') else str(nuevo_cupon.tipo),
        descuento_tipo=nuevo_cupon.descuento_tipo.value if hasattr(nuevo_cupon.descuento_tipo, 'value') else str(nuevo_cupon.descuento_tipo),
        descuento_valor=nuevo_cupon.descuento_valor,
        valido_desde=nuevo_cupon.valido_desde,
        valido_hasta=nuevo_cupon.valido_hasta,
        estado=nuevo_cupon.estado.value if hasattr(nuevo_cupon.estado, 'value') else str(nuevo_cupon.estado),
        creado_en=nuevo_cupon.creado_en
    )

@router.delete("/cupones/{cupon_id}", response_model=CuponResponse)
async def baja_logica_cupon(
    cupon_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(supervisor_o_director)
):
    """
    Baja lógica de cupón (cambia su estado a 'EXPIRADO').
    """
    cupon = await db.get(Cupon, cupon_id)
    if not cupon:
        raise HTTPException(status_code=404, detail="Cupón no encontrado")
        
    cupon.estado = EstadoCupon.EXPIRADO
    await db.commit()
    await db.refresh(cupon)
    
    cli = await db.get(Cliente, cupon.cliente_id)
    return CuponResponse(
        id=cupon.id,
        cliente_id=cupon.cliente_id,
        cliente_nombre=cli.nombre if cli else None,
        codigo=cupon.codigo,
        tipo=cupon.tipo.value if hasattr(cupon.tipo, 'value') else str(cupon.tipo),
        descuento_tipo=cupon.descuento_tipo.value if hasattr(cupon.descuento_tipo, 'value') else str(cupon.descuento_tipo),
        descuento_valor=cupon.descuento_valor,
        valido_desde=cupon.valido_desde,
        valido_hasta=cupon.valido_hasta,
        estado=cupon.estado.value if hasattr(cupon.estado, 'value') else str(cupon.estado),
        creado_en=cupon.creado_en
    )

@router.post("/cupones/validar", response_model=ValidarCuponResponse)
async def validar_cupon(
    req: ValidarCuponRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Valida las reglas de negocio de un cupón de descuento antes de aplicarlo al carrito.
    """
    result = await db.execute(select(Cupon).where(Cupon.codigo == req.codigo.strip().upper()))
    cupon = result.scalar_one_or_none()
    
    if not cupon:
        return ValidarCuponResponse(valido=False, mensaje="Cupón inexistente")
        
    # Validar estado
    estado_val = cupon.estado.value if hasattr(cupon.estado, 'value') else str(cupon.estado)
    if estado_val != 'EMITIDO':
        return ValidarCuponResponse(valido=False, mensaje=f"El cupón ya fue {estado_val.lower()}")
        
    # Validar vigencia temporal
    ahora = datetime.now().date()
    if cupon.valido_hasta and cupon.valido_hasta < ahora:
        cupon.estado = EstadoCupon.EXPIRADO
        await db.commit()
        return ValidarCuponResponse(valido=False, mensaje="El cupón ha expirado")
        
    if cupon.valido_desde and cupon.valido_desde > ahora:
        return ValidarCuponResponse(valido=False, mensaje="El cupón aún no es válido para su uso")
        
    tipo_desc = cupon.descuento_tipo.value if hasattr(cupon.descuento_tipo, 'value') else str(cupon.descuento_tipo)
    return ValidarCuponResponse(
        valido=True,
        mensaje="Cupón válido",
        tipo_descuento=tipo_desc,
        valor_descuento=cupon.descuento_valor,
        cupon_id=cupon.id
    )
