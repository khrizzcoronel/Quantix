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
    sucursal_id: Optional[UUID] = Query(None, description="Filtrar por sucursal específica"),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Listado general de clientes registrados con opción de búsqueda, filtro de activos y sucursal.
    """
    from sqlalchemy.orm import selectinload

    rol_val = getattr(current_user.rol, "value", str(current_user.rol))
    sucursal_filtro = sucursal_id
    if rol_val in ["SUPERVISOR", "CAJERO", "BODEGUERO"] and current_user.sucursal_id:
        if sucursal_id and sucursal_id != current_user.sucursal_id:
            raise HTTPException(status_code=403, detail="No tiene permisos para ver clientes de otra sucursal")
        sucursal_filtro = current_user.sucursal_id

    query = select(Cliente).options(selectinload(Cliente.sucursal))
    if sucursal_filtro:
        query = query.where(Cliente.sucursal_id == sucursal_filtro)
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
    Valida que la cédula y el teléfono no existan previamente y asigna la sucursal activa.
    """
    from sqlalchemy.orm import selectinload

    cedula_limpia = req.cedula.strip() if (req.cedula and req.cedula.strip()) else None
    tel_limpio = req.telefono.strip()

    if cedula_limpia:
        existente_ced = await db.execute(select(Cliente).where(Cliente.cedula == cedula_limpia))
        if existente_ced.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Ya existe un cliente con esta cédula de identidad")

    existente_tel = await db.execute(select(Cliente).where(Cliente.telefono == tel_limpio))
    if existente_tel.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe un cliente con este número de celular/teléfono")
        
    rol_val = getattr(current_user.rol, "value", str(current_user.rol))
    sucursal_asig = req.sucursal_id
    if rol_val in ["SUPERVISOR", "CAJERO", "BODEGUERO"] and current_user.sucursal_id:
        sucursal_asig = current_user.sucursal_id
    elif not sucursal_asig and current_user.sucursal_id:
        sucursal_asig = current_user.sucursal_id

    nuevo_cliente = Cliente(
        sucursal_id=sucursal_asig,
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
    
    result = await db.execute(select(Cliente).options(selectinload(Cliente.sucursal)).where(Cliente.id == nuevo_cliente.id))
    return result.scalar_one()

@router.get("/clientes/buscar/{identificador}", response_model=ClienteResponse)
async def buscar_cliente_por_identificador(
    identificador: str,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Búsqueda ágil de cliente en caja por Cédula o Teléfono celular para asociarlo a una venta.
    """
    from sqlalchemy.orm import selectinload
    id_limpio = identificador.strip()
    result = await db.execute(
        select(Cliente)
        .options(selectinload(Cliente.sucursal))
        .where(
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
    from sqlalchemy.orm import selectinload
    result = await db.execute(select(Cliente).options(selectinload(Cliente.sucursal)).where(Cliente.id == cliente_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    rol_val = getattr(current_user.rol, "value", str(current_user.rol))
    if rol_val in ["SUPERVISOR", "CAJERO", "BODEGUERO"] and current_user.sucursal_id:
        if cliente.sucursal_id and cliente.sucursal_id != current_user.sucursal_id:
            raise HTTPException(status_code=403, detail="No tiene permisos para acceder a clientes de otra sucursal")

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
    from sqlalchemy.orm import selectinload
    result = await db.execute(select(Cliente).options(selectinload(Cliente.sucursal)).where(Cliente.id == cliente_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    rol_val = getattr(current_user.rol, "value", str(current_user.rol))
    if rol_val in ["SUPERVISOR", "CAJERO", "BODEGUERO"] and current_user.sucursal_id:
        if cliente.sucursal_id and cliente.sucursal_id != current_user.sucursal_id:
            raise HTTPException(status_code=403, detail="No tiene permisos para modificar este cliente")
        
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
    if req.sucursal_id is not None and rol_val == "DIRECTOR":
        cliente.sucursal_id = req.sucursal_id
        
    await db.commit()
    await db.refresh(cliente)

    result = await db.execute(select(Cliente).options(selectinload(Cliente.sucursal)).where(Cliente.id == cliente_id))
    return result.scalar_one()

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
    sucursal_id: Optional[UUID] = Query(None, description="Filtrar por sucursal específica"),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Lista todos los cupones emitidos en el sistema con soporte multisede y RBAC.
    """
    from sqlalchemy.orm import selectinload

    rol_val = getattr(current_user.rol, "value", str(current_user.rol))
    sucursal_filtro = sucursal_id
    if rol_val in ["SUPERVISOR", "CAJERO", "BODEGUERO"] and current_user.sucursal_id:
        if sucursal_id and sucursal_id != current_user.sucursal_id:
            raise HTTPException(status_code=403, detail="No tiene permisos para ver cupones de otra sucursal")
        sucursal_filtro = current_user.sucursal_id

    query = (
        select(Cupon)
        .options(selectinload(Cupon.cliente), selectinload(Cupon.sucursal))
    )
    if sucursal_filtro:
        query = query.where(Cupon.sucursal_id == sucursal_filtro)

    query = query.order_by(Cupon.creado_en.desc())
    result = await db.execute(query)
    cupones = result.scalars().all()
    
    return [
        CuponResponse(
            id=c.id,
            cliente_id=c.cliente_id,
            cliente_nombre=c.cliente.nombre if c.cliente else None,
            sucursal_id=c.sucursal_id,
            sucursal_nombre=c.sucursal.nombre if c.sucursal else None,
            codigo=c.codigo,
            tipo=c.tipo.value if hasattr(c.tipo, 'value') else str(c.tipo),
            descuento_tipo=c.descuento_tipo.value if hasattr(c.descuento_tipo, 'value') else str(c.descuento_tipo),
            descuento_valor=c.descuento_valor,
            valido_desde=c.valido_desde,
            valido_hasta=c.valido_hasta,
            estado=c.estado.value if hasattr(c.estado, 'value') else str(c.estado),
            creado_en=c.creado_en
        )
        for c in cupones
    ]

@router.post("/cupones", response_model=CuponResponse, status_code=status.HTTP_201_CREATED)
async def crear_cupon(
    req: CuponCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(supervisor_o_director)
):
    """
    Crea un nuevo cupón asignado a un cliente y a una sucursal.
    """
    cliente = await db.get(Cliente, req.cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente asignado no existe")

    rol_val = getattr(current_user.rol, "value", str(current_user.rol))
    if rol_val in ["SUPERVISOR", "CAJERO", "BODEGUERO"] and current_user.sucursal_id:
        if cliente.sucursal_id and cliente.sucursal_id != current_user.sucursal_id:
            raise HTTPException(status_code=403, detail="No puede emitir cupones para clientes de otra sucursal")
        
    existente = await db.execute(select(Cupon).where(Cupon.codigo == req.codigo.strip().upper()))
    if existente.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe un cupón con este código")
        
    ahora = datetime.now()
    val_desde = req.valido_desde or ahora.date()
    val_hasta = req.valido_hasta or (ahora + timedelta(days=30)).date()

    sucursal_asig = req.sucursal_id
    if rol_val in ["SUPERVISOR", "CAJERO", "BODEGUERO"] and current_user.sucursal_id:
        sucursal_asig = current_user.sucursal_id
    elif not sucursal_asig:
        sucursal_asig = cliente.sucursal_id or current_user.sucursal_id

    nuevo_cupon = Cupon(
        cliente_id=req.cliente_id,
        sucursal_id=sucursal_asig,
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
    
    from app.models.sucursal import Sucursal
    sucursal_obj = await db.get(Sucursal, sucursal_asig) if sucursal_asig else None

    return CuponResponse(
        id=nuevo_cupon.id,
        cliente_id=nuevo_cupon.cliente_id,
        cliente_nombre=cliente.nombre,
        sucursal_id=nuevo_cupon.sucursal_id,
        sucursal_nombre=sucursal_obj.nombre if sucursal_obj else None,
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

    rol_val = getattr(current_user.rol, "value", str(current_user.rol))
    if rol_val in ["SUPERVISOR", "CAJERO", "BODEGUERO"] and current_user.sucursal_id:
        if cupon.sucursal_id and cupon.sucursal_id != current_user.sucursal_id:
            raise HTTPException(status_code=403, detail="No tiene permisos para modificar cupones de otra sucursal")
        
    cupon.estado = EstadoCupon.EXPIRADO
    await db.commit()
    await db.refresh(cupon)
    
    from app.models.sucursal import Sucursal
    cli = await db.get(Cliente, cupon.cliente_id)
    suc = await db.get(Sucursal, cupon.sucursal_id) if cupon.sucursal_id else None

    return CuponResponse(
        id=cupon.id,
        cliente_id=cupon.cliente_id,
        cliente_nombre=cli.nombre if cli else None,
        sucursal_id=cupon.sucursal_id,
        sucursal_nombre=suc.nombre if suc else None,
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
    Verifica también compatibilidad con la sucursal de emisión.
    """
    result = await db.execute(select(Cupon).where(Cupon.codigo == req.codigo.strip().upper()))
    cupon = result.scalar_one_or_none()
    
    if not cupon:
        return ValidarCuponResponse(valido=False, mensaje="Cupón inexistente")

    # Validar compatibilidad de sucursal si el cupón está acotado a una sucursal
    sucursal_operacion = req.sucursal_id or current_user.sucursal_id
    if cupon.sucursal_id and sucursal_operacion and cupon.sucursal_id != sucursal_operacion:
        return ValidarCuponResponse(valido=False, mensaje="Este cupón es exclusivo de otra sucursal y no puede canjearse aquí")
        
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
