from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, case, and_
from sqlalchemy.orm import selectinload, joinedload
from typing import List, Optional
from datetime import date, datetime, timedelta
import uuid
from uuid import UUID
from decimal import Decimal
import math

from app.db.oltp import get_db
from app.api.deps import RoleChecker, get_current_user, enforce_sucursal_scope
from app.models.usuarios import Usuario, AuditoriaEvento
from app.models.inventario import (
    Categoria, Proveedor, Producto, LoteInventario, 
    OrdenCompra, DetalleOrdenCompra, EstadoOrdenCompra, EstadoLote
)
from app.models.ventas import Venta, DetalleVenta, EstadoVenta
from app.schemas.inventario import (
    CategoriaCreate, CategoriaUpdate, CategoriaResponse,
    ProveedorCreate, ProveedorUpdate, ProveedorResponse,
    ProductoCreate, ProductoUpdate, ProductoResponse,
    IngresoLoteDirectoRequest, LoteUpdate, LoteBajaRequest, LoteResponse,
    DetalleOrdenCompraCreate, OrdenCompraCreate, OrdenCompraUpdate,
    DetalleOrdenCompraResponse, OrdenCompraResponse, DetalleOrdenResponse,
    RecepcionOrdenRequest, SugerenciaReordenResponse, OrdenCompraRequest
)

router = APIRouter()

# Control de accesos por rol
bodega_roles = RoleChecker(["BODEGUERO", "SUPERVISOR", "DIRECTOR"])
director_supervisor_roles = RoleChecker(["SUPERVISOR", "DIRECTOR"])

# =============================================================================
# 1. CATEGORIAS (CRUD COMPLETO CON BAJA LÓGICA)
# =============================================================================

@router.get("/categorias", response_model=List[CategoriaResponse])
async def listar_categorias(
    activo_only: bool = Query(False, description="Filtrar solo categorías activas"),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    query = select(Categoria)
    if activo_only:
        query = query.where(Categoria.activo == True)
    query = query.order_by(Categoria.nombre.asc())
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/categorias", response_model=CategoriaResponse, status_code=status.HTTP_201_CREATED)
async def crear_categoria(
    req: CategoriaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(bodega_roles)
):
    existente = await db.execute(select(Categoria).where(Categoria.nombre == req.nombre))
    if existente.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe una categoría con este nombre")
    
    categoria = Categoria(nombre=req.nombre, descripcion=req.descripcion, activo=True)
    db.add(categoria)
    await db.commit()
    await db.refresh(categoria)
    return categoria

@router.put("/categorias/{categoria_id}", response_model=CategoriaResponse)
async def actualizar_categoria(
    categoria_id: UUID,
    req: CategoriaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(bodega_roles)
):
    categoria = await db.get(Categoria, categoria_id)
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    
    if req.nombre is not None:
        duplicado = await db.execute(
            select(Categoria).where(Categoria.nombre == req.nombre, Categoria.id != categoria_id)
        )
        if duplicado.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Ya existe otra categoría con este nombre")
        categoria.nombre = req.nombre
        
    if req.descripcion is not None:
        categoria.descripcion = req.descripcion
    if req.activo is not None:
        categoria.activo = req.activo
        
    await db.commit()
    await db.refresh(categoria)
    return categoria

@router.delete("/categorias/{categoria_id}", response_model=CategoriaResponse)
async def baja_logica_categoria(
    categoria_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(director_supervisor_roles)
):
    categoria = await db.get(Categoria, categoria_id)
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    
    categoria.activo = False
    await db.commit()
    await db.refresh(categoria)
    return categoria

# =============================================================================
# 2. PROVEEDORES (CRUD COMPLETO CON BAJA LÓGICA)
# =============================================================================

@router.get("/proveedores", response_model=List[ProveedorResponse])
async def listar_proveedores(
    activo_only: bool = Query(False, description="Filtrar solo proveedores activos"),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    query = select(Proveedor)
    if activo_only:
        query = query.where(Proveedor.activo == True)
    query = query.order_by(Proveedor.nombre.asc())
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/proveedores", response_model=ProveedorResponse, status_code=status.HTTP_201_CREATED)
async def crear_proveedor(
    req: ProveedorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(bodega_roles)
):
    proveedor = Proveedor(
        nombre=req.nombre,
        contacto_nombre=req.contacto_nombre,
        telefono=req.telefono,
        email=req.email,
        lead_time_dias=req.lead_time_dias or 7,
        activo=True
    )
    db.add(proveedor)
    await db.commit()
    await db.refresh(proveedor)
    return proveedor

@router.put("/proveedores/{proveedor_id}", response_model=ProveedorResponse)
async def actualizar_proveedor(
    proveedor_id: UUID,
    req: ProveedorUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(bodega_roles)
):
    proveedor = await db.get(Proveedor, proveedor_id)
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    
    if req.nombre is not None:
        proveedor.nombre = req.nombre
    if req.contacto_nombre is not None:
        proveedor.contacto_nombre = req.contacto_nombre
    if req.telefono is not None:
        proveedor.telefono = req.telefono
    if req.email is not None:
        proveedor.email = req.email
    if req.lead_time_dias is not None:
        proveedor.lead_time_dias = req.lead_time_dias
    if req.activo is not None:
        proveedor.activo = req.activo
        
    await db.commit()
    await db.refresh(proveedor)
    return proveedor

@router.delete("/proveedores/{proveedor_id}", response_model=ProveedorResponse)
async def baja_logica_proveedor(
    proveedor_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(director_supervisor_roles)
):
    proveedor = await db.get(Proveedor, proveedor_id)
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    
    proveedor.activo = False
    await db.commit()
    await db.refresh(proveedor)
    return proveedor

# =============================================================================
# 3. PRODUCTOS (CRUD COMPLETO CON CÁLCULO DINÁMICO DE STOCK Y BAJA LÓGICA)
# =============================================================================

@router.get("/productos", response_model=List[ProductoResponse])
async def listar_productos(
    activo_only: bool = Query(False, description="Filtrar solo productos activos"),
    categoria_id: Optional[UUID] = Query(None, description="Filtrar por categoría"),
    sucursal_id: Optional[UUID] = Query(None, description="Filtrar stock consolidado por sucursal"),
    q: Optional[str] = Query(None, description="Búsqueda por nombre, SKU o código de barras"),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    # Sumar solo lotes con estado ACTIVO
    stock_expr = func.coalesce(
        func.sum(
            case((LoteInventario.estado == EstadoLote.ACTIVO, LoteInventario.cantidad_disponible), else_=Decimal("0"))
        ),
        Decimal("0")
    ).label("stock_total")

    lotes_count_expr = func.count(
        case((LoteInventario.estado == EstadoLote.ACTIVO, LoteInventario.id), else_=None)
    ).label("lotes_activos_count")

    sucursal_efectiva = enforce_sucursal_scope(current_user, sucursal_id)
    lote_join = (LoteInventario.producto_id == Producto.id)
    if sucursal_efectiva:
        lote_join = and_(lote_join, LoteInventario.sucursal_id == sucursal_efectiva)

    query = (
        select(
            Producto,
            Categoria.nombre.label("categoria_nombre"),
            stock_expr,
            lotes_count_expr
        )
        .outerjoin(Categoria, Producto.categoria_id == Categoria.id)
        .outerjoin(LoteInventario, lote_join)
    )

    if activo_only:
        query = query.where(Producto.activo == True)
    if categoria_id:
        query = query.where(Producto.categoria_id == categoria_id)
    if q:
        termino = f"%{q.strip()}%"
        query = query.where(
            or_(
                Producto.nombre.ilike(termino),
                Producto.sku.ilike(termino),
                Producto.codigo_barras.ilike(termino)
            )
        )

    query = query.group_by(Producto.id, Categoria.nombre).order_by(Producto.nombre.asc())
    result = await db.execute(query)
    rows = result.all()

    productos_resp = []
    for prod, cat_nom, stock, lotes_cnt in rows:
        resp = ProductoResponse(
            id=prod.id,
            categoria_id=prod.categoria_id,
            categoria_nombre=cat_nom,
            sku=prod.sku,
            nombre=prod.nombre,
            codigo_barras=prod.codigo_barras,
            costo_base=prod.costo_base,
            precio_venta=prod.precio_venta,
            margen_minimo_pct=prod.margen_minimo_pct,
            requiere_pesaje=prod.requiere_pesaje,
            clasificacion_abc=prod.clasificacion_abc,
            imagen=prod.imagen,
            activo=prod.activo,
            stock_total=Decimal(str(stock or 0)),
            lotes_activos_count=int(lotes_cnt or 0)
        )
        productos_resp.append(resp)

    return productos_resp

@router.get("/productos/{producto_id}", response_model=ProductoResponse)
async def obtener_producto(
    producto_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    stock_expr = func.coalesce(
        func.sum(
            case((LoteInventario.estado == EstadoLote.ACTIVO, LoteInventario.cantidad_disponible), else_=Decimal("0"))
        ),
        Decimal("0")
    ).label("stock_total")

    lotes_count_expr = func.count(
        case((LoteInventario.estado == EstadoLote.ACTIVO, LoteInventario.id), else_=None)
    ).label("lotes_activos_count")

    query = (
        select(
            Producto,
            Categoria.nombre.label("categoria_nombre"),
            stock_expr,
            lotes_count_expr
        )
        .outerjoin(Categoria, Producto.categoria_id == Categoria.id)
        .outerjoin(LoteInventario, LoteInventario.producto_id == Producto.id)
        .where(Producto.id == producto_id)
        .group_by(Producto.id, Categoria.nombre)
    )
    result = await db.execute(query)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    prod, cat_nom, stock, lotes_cnt = row
    return ProductoResponse(
        id=prod.id,
        categoria_id=prod.categoria_id,
        categoria_nombre=cat_nom,
        sku=prod.sku,
        nombre=prod.nombre,
        codigo_barras=prod.codigo_barras,
        costo_base=prod.costo_base,
        precio_venta=prod.precio_venta,
        margen_minimo_pct=prod.margen_minimo_pct,
        requiere_pesaje=prod.requiere_pesaje,
        clasificacion_abc=prod.clasificacion_abc,
        imagen=prod.imagen,
        activo=prod.activo,
        stock_total=Decimal(str(stock or 0)),
        lotes_activos_count=int(lotes_cnt or 0)
    )

@router.post("/productos", response_model=ProductoResponse, status_code=status.HTTP_201_CREATED)
async def crear_producto(
    req: ProductoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(bodega_roles)
):
    # Validar que categoría existe
    cat = await db.get(Categoria, req.categoria_id)
    if not cat:
        raise HTTPException(status_code=400, detail="Categoría no válida")

    # Validar SKU único
    sku_existente = await db.execute(select(Producto).where(Producto.sku == req.sku))
    if sku_existente.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe un producto con este SKU")
    
    # Validar Código de Barras si se provee
    if req.codigo_barras:
        cb_existente = await db.execute(select(Producto).where(Producto.codigo_barras == req.codigo_barras))
        if cb_existente.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Ya existe un producto con este Código de Barras")
    
    producto = Producto(
        categoria_id=req.categoria_id,
        sku=req.sku,
        nombre=req.nombre,
        codigo_barras=req.codigo_barras,
        costo_base=req.costo_base,
        precio_venta=req.precio_venta,
        margen_minimo_pct=req.margen_minimo_pct or Decimal("15.0"),
        requiere_pesaje=req.requiere_pesaje,
        clasificacion_abc=req.clasificacion_abc or "A",
        imagen=req.imagen,
        activo=True
    )
    db.add(producto)
    await db.commit()
    await db.refresh(producto)

    return ProductoResponse(
        id=producto.id,
        categoria_id=producto.categoria_id,
        categoria_nombre=cat.nombre,
        sku=producto.sku,
        nombre=producto.nombre,
        codigo_barras=producto.codigo_barras,
        costo_base=producto.costo_base,
        precio_venta=producto.precio_venta,
        margen_minimo_pct=producto.margen_minimo_pct,
        requiere_pesaje=producto.requiere_pesaje,
        clasificacion_abc=producto.clasificacion_abc,
        imagen=producto.imagen,
        activo=producto.activo,
        stock_total=Decimal("0"),
        lotes_activos_count=0
    )

@router.put("/productos/{producto_id}", response_model=ProductoResponse)
async def actualizar_producto(
    producto_id: UUID,
    req: ProductoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(bodega_roles)
):
    producto = await db.get(Producto, producto_id)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    if req.categoria_id is not None:
        cat = await db.get(Categoria, req.categoria_id)
        if not cat:
            raise HTTPException(status_code=400, detail="Categoría no válida")
        producto.categoria_id = req.categoria_id
        
    if req.sku is not None:
        sku_duplicado = await db.execute(
            select(Producto).where(Producto.sku == req.sku, Producto.id != producto_id)
        )
        if sku_duplicado.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Ya existe otro producto con este SKU")
        producto.sku = req.sku

    if req.codigo_barras is not None:
        cb_duplicado = await db.execute(
            select(Producto).where(Producto.codigo_barras == req.codigo_barras, Producto.id != producto_id)
        )
        if cb_duplicado.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Ya existe otro producto con este Código de Barras")
        producto.codigo_barras = req.codigo_barras

    if req.nombre is not None:
        producto.nombre = req.nombre
    if req.costo_base is not None:
        producto.costo_base = req.costo_base
    if req.precio_venta is not None:
        producto.precio_venta = req.precio_venta
    if req.margen_minimo_pct is not None:
        producto.margen_minimo_pct = req.margen_minimo_pct
    if req.requiere_pesaje is not None:
        producto.requiere_pesaje = req.requiere_pesaje
    if req.clasificacion_abc is not None:
        producto.clasificacion_abc = req.clasificacion_abc
    if req.imagen is not None:
        producto.imagen = req.imagen if req.imagen.strip() else None
    if req.activo is not None:
        producto.activo = req.activo

    await db.commit()
    return await obtener_producto(producto_id, db, current_user)

@router.delete("/productos/{producto_id}", response_model=ProductoResponse)
async def baja_logica_producto(
    producto_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(director_supervisor_roles)
):
    producto = await db.get(Producto, producto_id)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    producto.activo = False
    await db.commit()
    return await obtener_producto(producto_id, db, current_user)

# =============================================================================
# 4. LOTES E INGRESO DIRECTO DE MERCANCÍA (CON BAJA LÓGICA POR MERMA/CADUCADO)
# =============================================================================

@router.get("/lotes", response_model=List[LoteResponse])
async def listar_lotes(
    producto_id: Optional[UUID] = Query(None, description="Filtrar por producto"),
    estado: Optional[str] = Query(None, description="Filtrar por estado (ACTIVO, AGOTADO, CADUCADO, MERMA)"),
    sucursal_id: Optional[UUID] = Query(None, description="Filtrar por sucursal"),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    sucursal_efectiva = enforce_sucursal_scope(current_user, sucursal_id)
    query = (
        select(LoteInventario, Producto.nombre.label("producto_nombre"), Producto.sku.label("producto_sku"))
        .join(Producto, LoteInventario.producto_id == Producto.id)
    )
    if producto_id:
        query = query.where(LoteInventario.producto_id == producto_id)
    if estado:
        query = query.where(LoteInventario.estado == estado)
    if sucursal_efectiva:
        query = query.where(LoteInventario.sucursal_id == sucursal_efectiva)

    query = query.order_by(LoteInventario.fecha_vencimiento.asc().nullslast(), LoteInventario.fecha_ingreso.desc())
    result = await db.execute(query)
    rows = result.all()

    lotes_resp = []
    for lote, prod_nom, prod_sku in rows:
        lotes_resp.append(
            LoteResponse(
                id=lote.id,
                producto_id=lote.producto_id,
                producto_nombre=prod_nom,
                producto_sku=prod_sku,
                codigo_lote=lote.codigo_lote,
                cantidad_inicial=lote.cantidad_inicial,
                cantidad_disponible=lote.cantidad_disponible,
                costo_unitario=lote.costo_unitario,
                fecha_ingreso=lote.fecha_ingreso,
                fecha_vencimiento=lote.fecha_vencimiento,
                estado=lote.estado.value if hasattr(lote.estado, 'value') else str(lote.estado),
                sucursal_id=lote.sucursal_id
            )
        )
    return lotes_resp

@router.post("/lotes/ingreso-directo", response_model=LoteResponse, status_code=status.HTTP_201_CREATED)
async def registrar_ingreso_directo(
    req: IngresoLoteDirectoRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(bodega_roles)
):
    """
    Registra un ingreso directo de mercancía con lote y fecha de caducidad.
    Permite nutrir inventario sin necesidad de una Orden de Compra formal previa.
    """
    producto = await db.get(Producto, req.producto_id)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    sucursal_id_lote = enforce_sucursal_scope(current_user, req.sucursal_id)
    if not sucursal_id_lote:
        sucursal_id_lote = getattr(current_user, 'sucursal_id', None) or UUID("00000000-0000-0000-0000-000000000001")

    nuevo_lote = LoteInventario(
        producto_id=req.producto_id,
        codigo_lote=req.codigo_lote,
        cantidad_inicial=req.cantidad,
        cantidad_disponible=req.cantidad,
        costo_unitario=req.costo_unitario,
        fecha_vencimiento=req.fecha_vencimiento,
        estado=EstadoLote.ACTIVO,
        sucursal_id=sucursal_id_lote
    )
    db.add(nuevo_lote)
    
    # Registro de auditoría
    auditoria = AuditoriaEvento(
        usuario_id=current_user.id,
        tipo_evento="INGRESO_DIRECTO_MERCANCIA",
        descripcion=f"Ingreso directo de {req.cantidad} uds del producto {producto.nombre} (SKU: {producto.sku}) lote {req.codigo_lote}",
        gravedad="INFO",
        detalle_json={
            "producto_id": str(producto.id),
            "cantidad": str(req.cantidad),
            "costo_unitario": str(req.costo_unitario),
            "codigo_lote": req.codigo_lote,
            "fecha_vencimiento": str(req.fecha_vencimiento) if req.fecha_vencimiento else None,
            "notas": req.notas
        }
    )
    db.add(auditoria)

    await db.commit()
    await db.refresh(nuevo_lote)

    return LoteResponse(
        id=nuevo_lote.id,
        producto_id=nuevo_lote.producto_id,
        producto_nombre=producto.nombre,
        producto_sku=producto.sku,
        codigo_lote=nuevo_lote.codigo_lote,
        cantidad_inicial=nuevo_lote.cantidad_inicial,
        cantidad_disponible=nuevo_lote.cantidad_disponible,
        costo_unitario=nuevo_lote.costo_unitario,
        fecha_ingreso=nuevo_lote.fecha_ingreso,
        fecha_vencimiento=nuevo_lote.fecha_vencimiento,
        estado=nuevo_lote.estado.value if hasattr(nuevo_lote.estado, 'value') else str(nuevo_lote.estado),
        sucursal_id=nuevo_lote.sucursal_id
    )

@router.put("/lotes/{lote_id}", response_model=LoteResponse)
async def modificar_lote(
    lote_id: UUID,
    req: LoteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(bodega_roles)
):
    lote = await db.get(LoteInventario, lote_id)
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")

    rol_str = current_user.rol.value if hasattr(current_user.rol, 'value') else str(current_user.rol)
    if rol_str != "DIRECTOR" and current_user.sucursal_id:
        if lote.sucursal_id and lote.sucursal_id != current_user.sucursal_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acceso denegado: No tienes autorización para modificar lotes de otra sucursal"
            )
    
    if req.codigo_lote is not None:
        lote.codigo_lote = req.codigo_lote
    if req.costo_unitario is not None:
        lote.costo_unitario = req.costo_unitario
    if req.fecha_vencimiento is not None:
        lote.fecha_vencimiento = req.fecha_vencimiento
        
    await db.commit()
    await db.refresh(lote)

    prod = await db.get(Producto, lote.producto_id)
    return LoteResponse(
        id=lote.id,
        producto_id=lote.producto_id,
        producto_nombre=prod.nombre if prod else None,
        producto_sku=prod.sku if prod else None,
        codigo_lote=lote.codigo_lote,
        cantidad_inicial=lote.cantidad_inicial,
        cantidad_disponible=lote.cantidad_disponible,
        costo_unitario=lote.costo_unitario,
        fecha_ingreso=lote.fecha_ingreso,
        fecha_vencimiento=lote.fecha_vencimiento,
        estado=lote.estado.value if hasattr(lote.estado, 'value') else str(lote.estado)
    )

@router.post("/lotes/{lote_id}/baja", response_model=LoteResponse)
async def dar_de_baja_lote(
    lote_id: UUID,
    req: LoteBajaRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(director_supervisor_roles)
):
    """
    Baja lógica de mercancía/lote por merma, caducidad, daño o cuarentena.
    Audita la pérdida en AuditoriaEvento y descuenta el stock disponible.
    """
    lote = await db.get(LoteInventario, lote_id)
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")

    rol_str = current_user.rol.value if hasattr(current_user.rol, 'value') else str(current_user.rol)
    if rol_str != "DIRECTOR" and current_user.sucursal_id:
        if lote.sucursal_id and lote.sucursal_id != current_user.sucursal_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acceso denegado: No tienes autorización para dar de baja lotes de otra sucursal"
            )
    
    cant_baja = req.cantidad_baja if req.cantidad_baja is not None else lote.cantidad_disponible
    if cant_baja <= 0:
        raise HTTPException(status_code=400, detail="La cantidad a dar de baja debe ser mayor a cero")
    if cant_baja > lote.cantidad_disponible:
        raise HTTPException(
            status_code=400, 
            detail=f"La cantidad a dar de baja ({cant_baja}) supera el stock disponible del lote ({lote.cantidad_disponible})"
        )

    lote.cantidad_disponible -= cant_baja
    if lote.cantidad_disponible == 0:
        if req.motivo == "CADUCADO":
            lote.estado = EstadoLote.CADUCADO
        else:
            lote.estado = EstadoLote.MERMA
            
    producto = await db.get(Producto, lote.producto_id)

    # Auditoría Forense de Merma
    auditoria = AuditoriaEvento(
        usuario_id=current_user.id,
        tipo_evento=f"BAJA_INVENTARIO_{req.motivo.upper()}",
        descripcion=f"Baja de {cant_baja} unidades del lote {lote.codigo_lote} (Producto: {producto.nombre if producto else 'N/A'}). Motivo: {req.motivo}",
        gravedad="MEDIA",
        detalle_json={
            "lote_id": str(lote.id),
            "codigo_lote": lote.codigo_lote,
            "producto_id": str(lote.producto_id),
            "cantidad_baja": str(cant_baja),
            "motivo": req.motivo,
            "notas": req.notas
        }
    )
    db.add(auditoria)

    await db.commit()
    await db.refresh(lote)

    # Emitir evento en tiempo real para supervisión y trazabilidad sanitaria
    try:
        from app.api.ws import notif_manager
        await notif_manager.notificar_evento({
            "tipo": "ALERTA_SANITARIA",
            "titulo": f"Baja por Merma ({req.motivo})",
            "mensaje": f"Baja de {cant_baja} unidades del lote {lote.codigo_lote} ({producto.nombre if producto else 'N/A'}). Motivo: {req.motivo}",
            "severidad": "CRITICO" if req.motivo == "CADUCADO" else "WARNING",
            "payload": {
                "lote_id": str(lote.id),
                "codigo_lote": lote.codigo_lote,
                "producto": producto.nombre if producto else "N/A",
                "cantidad": float(cant_baja),
                "motivo": req.motivo,
                "autorizador": current_user.nombre_completo
            }
        })
    except Exception:
        pass

    return LoteResponse(
        id=lote.id,
        producto_id=lote.producto_id,
        producto_nombre=producto.nombre if producto else None,
        producto_sku=producto.sku if producto else None,
        codigo_lote=lote.codigo_lote,
        cantidad_inicial=lote.cantidad_inicial,
        cantidad_disponible=lote.cantidad_disponible,
        costo_unitario=lote.costo_unitario,
        fecha_ingreso=lote.fecha_ingreso,
        fecha_vencimiento=lote.fecha_vencimiento,
        estado=lote.estado.value if hasattr(lote.estado, 'value') else str(lote.estado)
    )

# =============================================================================
# 5. ORDENES DE COMPRA, CADENA DE SUMINISTRO Y RECEPCIÓN
# =============================================================================

@router.get("/ordenes-compra", response_model=List[OrdenCompraResponse])
async def listar_ordenes_compra(
    estado: Optional[str] = Query(None, description="Filtrar por estado: PENDIENTE, RECIBIDA, CANCELADA"),
    proveedor_id: Optional[UUID] = Query(None, description="Filtrar por proveedor"),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(bodega_roles)
):
    query = (
        select(OrdenCompra)
        .options(
            joinedload(OrdenCompra.proveedor),
            selectinload(OrdenCompra.detalles).joinedload(DetalleOrdenCompra.producto),
            selectinload(OrdenCompra.lotes).joinedload(LoteInventario.producto)
        )
    )
    if estado:
        query = query.where(OrdenCompra.estado == estado)
    if proveedor_id:
        query = query.where(OrdenCompra.proveedor_id == proveedor_id)

    query = query.order_by(OrdenCompra.fecha_emision.desc())
    result = await db.execute(query)
    ordenes = result.scalars().all()

    resp = []
    for o in ordenes:
        detalles_resp = [
            DetalleOrdenCompraResponse(
                id=d.id,
                orden_compra_id=d.orden_compra_id,
                producto_id=d.producto_id,
                producto_nombre=d.producto.nombre if d.producto else None,
                producto_sku=d.producto.sku if d.producto else None,
                cantidad_solicitada=d.cantidad_solicitada,
                cantidad_recibida=d.cantidad_recibida or Decimal("0.00"),
                cantidad_pendiente=max(Decimal("0.00"), d.cantidad_solicitada - (d.cantidad_recibida or Decimal("0.00"))),
                costo_unitario_pactado=d.costo_unitario_pactado,
                subtotal=Decimal(str(round(d.cantidad_solicitada * d.costo_unitario_pactado, 2)))
            )
            for d in o.detalles
        ]
        lotes_resp = [
            LoteResponse(
                id=l.id,
                producto_id=l.producto_id,
                producto_nombre=l.producto.nombre if l.producto else None,
                producto_sku=l.producto.sku if l.producto else None,
                codigo_lote=l.codigo_lote,
                cantidad_inicial=l.cantidad_inicial,
                cantidad_disponible=l.cantidad_disponible,
                costo_unitario=l.costo_unitario,
                fecha_ingreso=l.fecha_ingreso,
                fecha_vencimiento=l.fecha_vencimiento,
                estado=l.estado.value if hasattr(l.estado, 'value') else str(l.estado)
            )
            for l in (o.lotes or [])
        ]
        total_est = sum(d.subtotal or Decimal("0") for d in detalles_resp)

        resp.append(
            OrdenCompraResponse(
                id=o.id,
                proveedor_id=o.proveedor_id,
                proveedor_nombre=o.proveedor.nombre if o.proveedor else None,
                usuario_solicitante_id=o.usuario_solicitante_id,
                usuario_solicitante_nombre=None,
                estado=o.estado.value if hasattr(o.estado, 'value') else str(o.estado),
                notas=o.notas,
                fecha_emision=o.fecha_emision,
                fecha_recepcion=o.fecha_recepcion,
                detalles=detalles_resp,
                lotes=lotes_resp,
                total_estimado=total_est
            )
        )
    return resp

@router.get("/ordenes-compra/sugerencias", response_model=List[SugerenciaReordenResponse])
async def sugerencias_reorden_compra(
    sucursal_id: Optional[UUID] = Query(None, description="Filtrar sugerencias por sucursal"),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(bodega_roles)
):
    """
    Calcula productos cuyo stock actual consolidado es inferior a su punto de reorden
    sugerido o productos con bajo stock / rotura inminente.
    """
    # 1. Obtener productos activos con categoría
    query_prod = (
        select(Producto, Categoria.nombre.label("categoria_nombre"))
        .outerjoin(Categoria, Producto.categoria_id == Categoria.id)
        .where(Producto.activo == True)
        .order_by(Producto.nombre.asc())
    )
    res_prod = await db.execute(query_prod)
    productos = res_prod.all()

    # 2. Stock consolidado activo por producto
    sucursal_efectiva = enforce_sucursal_scope(current_user, sucursal_id)
    query_stock = (
        select(
            LoteInventario.producto_id,
            func.coalesce(func.sum(LoteInventario.cantidad_disponible), Decimal("0")).label("stock_total")
        )
        .where(LoteInventario.estado == EstadoLote.ACTIVO)
    )
    if sucursal_efectiva:
        query_stock = query_stock.where(LoteInventario.sucursal_id == sucursal_efectiva)
    query_stock = query_stock.group_by(LoteInventario.producto_id)

    res_stock = await db.execute(query_stock)
    stock_map = {row.producto_id: Decimal(str(row.stock_total or 0)) for row in res_stock.all()}

    # 3. Ventas de los últimos 30 días por producto
    hace_30_dias = datetime.utcnow() - timedelta(days=30)
    query_ventas = (
        select(
            DetalleVenta.producto_id,
            func.coalesce(func.sum(DetalleVenta.cantidad), Decimal("0")).label("total_vendido")
        )
        .join(Venta, DetalleVenta.venta_id == Venta.id)
        .where(Venta.estado == EstadoVenta.COMPLETADA, Venta.fecha_hora >= hace_30_dias)
    )
    if sucursal_efectiva:
        query_ventas = query_ventas.where(Venta.sucursal_id == sucursal_efectiva)
    query_ventas = query_ventas.group_by(DetalleVenta.producto_id)

    res_ventas = await db.execute(query_ventas)
    ventas_map = {row.producto_id: Decimal(str(row.total_vendido or 0)) for row in res_ventas.all()}

    # 4. Proveedores activos por si se necesita sugerir
    res_prov = await db.execute(select(Proveedor).where(Proveedor.activo == True).order_by(Proveedor.lead_time_dias.asc()))
    proveedores_activos = res_prov.scalars().all()
    prov_default = proveedores_activos[0] if proveedores_activos else None

    # 5. Mapear último proveedor por producto a partir de compras pasadas
    query_ult_prov = (
        select(DetalleOrdenCompra.producto_id, Proveedor.id, Proveedor.nombre, Proveedor.lead_time_dias)
        .join(OrdenCompra, DetalleOrdenCompra.orden_compra_id == OrdenCompra.id)
        .join(Proveedor, OrdenCompra.proveedor_id == Proveedor.id)
        .order_by(OrdenCompra.fecha_emision.desc())
    )
    res_ult_prov = await db.execute(query_ult_prov)
    ult_prov_map = {}
    for prod_id, p_id, p_nom, lead_t in res_ult_prov.all():
        if prod_id not in ult_prov_map:
            ult_prov_map[prod_id] = (p_id, p_nom, lead_t)

    sugerencias = []
    for prod, cat_nom in productos:
        stock_actual = stock_map.get(prod.id, Decimal("0"))
        unidades_vendidas = ventas_map.get(prod.id, Decimal("0"))
        
        # Proveedor sugerido y lead time
        if prod.id in ult_prov_map:
            prov_id, prov_nombre, lead_time = ult_prov_map[prod.id]
        elif prov_default:
            prov_id, prov_nombre, lead_time = prov_default.id, prov_default.nombre, prov_default.lead_time_dias
        else:
            prov_id, prov_nombre, lead_time = None, None, 7
        
        lead_time = lead_time or 7

        # Safety stock según clasificación ABC
        abc = (prod.clasificacion_abc or "A").upper()
        if abc == "A":
            safety_stock = Decimal("15")
        elif abc == "B":
            safety_stock = Decimal("10")
        else:
            safety_stock = Decimal("5")

        # Calcular punto de reorden
        if unidades_vendidas > 0:
            velocidad_diaria = unidades_vendidas / Decimal("30.0")
            punto_reorden = Decimal(math.ceil(float((velocidad_diaria * Decimal(str(lead_time))) + safety_stock)))
        else:
            punto_reorden = safety_stock

        # Condición de reorden: stock actual es inferior o igual al punto de reorden o stock cero
        if stock_actual <= punto_reorden or stock_actual == Decimal("0"):
            sugerido = max(Decimal(math.ceil(float((punto_reorden * 2) - stock_actual))), Decimal("10"))
            
            if stock_actual == Decimal("0"):
                motivo = "Agotado / Sin stock en almacén"
            elif unidades_vendidas > 0:
                motivo = f"Stock ({stock_actual}) por debajo del punto de reorden dinámico ({punto_reorden})"
            else:
                motivo = f"Stock ({stock_actual}) bajo umbral mínimo de seguridad ({punto_reorden})"

            sugerencias.append(
                SugerenciaReordenResponse(
                    producto_id=prod.id,
                    sku=prod.sku,
                    nombre=prod.nombre,
                    categoria_nombre=cat_nom,
                    stock_actual=stock_actual,
                    punto_reorden=punto_reorden,
                    sugerido_compra=sugerido,
                    costo_base=prod.costo_base,
                    precio_venta=prod.precio_venta,
                    clasificacion_abc=prod.clasificacion_abc,
                    proveedor_sugerido_id=prov_id,
                    proveedor_sugerido_nombre=prov_nombre,
                    motivo=motivo
                )
            )

    return sugerencias

@router.post("/ordenes-compra", response_model=OrdenCompraResponse, status_code=status.HTTP_201_CREATED)
@router.post("/orden-compra", response_model=OrdenCompraResponse, status_code=status.HTTP_201_CREATED)
async def crear_orden_compra(
    req: OrdenCompraCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(bodega_roles)
):
    items = req.get_items()

    proveedor = await db.get(Proveedor, req.proveedor_id)
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    nueva_orden = OrdenCompra(
        proveedor_id=req.proveedor_id,
        usuario_solicitante_id=current_user.id,
        estado=EstadoOrdenCompra.PENDIENTE,
        notas=req.notas
    )
    db.add(nueva_orden)
    await db.flush()
    
    for item in items:
        producto = await db.get(Producto, item.producto_id)
        if not producto:
            raise HTTPException(status_code=400, detail=f"Producto con ID {item.producto_id} no encontrado")
        
        detalle = DetalleOrdenCompra(
            orden_compra_id=nueva_orden.id,
            producto_id=item.producto_id,
            cantidad_solicitada=item.cantidad_solicitada,
            costo_unitario_pactado=item.costo_unitario_pactado
        )
        db.add(detalle)
        
    auditoria = AuditoriaEvento(
        usuario_id=current_user.id,
        tipo_evento="CREACION_ORDEN_COMPRA",
        descripcion=f"Creación de orden de compra {nueva_orden.id} para proveedor {proveedor.nombre} con {len(items)} líneas",
        gravedad="INFO",
        detalle_json={
            "orden_id": str(nueva_orden.id),
            "proveedor_id": str(proveedor.id),
            "total_items": len(items)
        }
    )
    db.add(auditoria)

    await db.commit()
    await db.refresh(nueva_orden)
    
    return await obtener_orden_compra_detalle(nueva_orden.id, db)

async def obtener_orden_compra_detalle(orden_id: UUID, db: AsyncSession) -> OrdenCompraResponse:
    query = (
        select(OrdenCompra)
        .options(
            joinedload(OrdenCompra.proveedor),
            selectinload(OrdenCompra.detalles).joinedload(DetalleOrdenCompra.producto),
            selectinload(OrdenCompra.lotes).joinedload(LoteInventario.producto)
        )
        .where(OrdenCompra.id == orden_id)
    )
    res = await db.execute(query)
    o = res.scalar_one_or_none()
    if not o:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
        
    detalles_resp = [
        DetalleOrdenCompraResponse(
            id=d.id,
            orden_compra_id=d.orden_compra_id,
            producto_id=d.producto_id,
            producto_nombre=d.producto.nombre if d.producto else None,
            producto_sku=d.producto.sku if d.producto else None,
            cantidad_solicitada=d.cantidad_solicitada,
            cantidad_recibida=d.cantidad_recibida or Decimal("0.00"),
            cantidad_pendiente=max(Decimal("0.00"), d.cantidad_solicitada - (d.cantidad_recibida or Decimal("0.00"))),
            costo_unitario_pactado=d.costo_unitario_pactado,
            subtotal=Decimal(str(round(d.cantidad_solicitada * d.costo_unitario_pactado, 2)))
        )
        for d in o.detalles
    ]

    lotes_resp = [
        LoteResponse(
            id=l.id,
            producto_id=l.producto_id,
            producto_nombre=l.producto.nombre if l.producto else None,
            producto_sku=l.producto.sku if l.producto else None,
            codigo_lote=l.codigo_lote,
            cantidad_inicial=l.cantidad_inicial,
            cantidad_disponible=l.cantidad_disponible,
            costo_unitario=l.costo_unitario,
            fecha_ingreso=l.fecha_ingreso,
            fecha_vencimiento=l.fecha_vencimiento,
            estado=l.estado.value if hasattr(l.estado, 'value') else str(l.estado)
        )
        for l in (o.lotes or [])
    ]

    total_est = sum(d.subtotal or Decimal("0") for d in detalles_resp)

    return OrdenCompraResponse(
        id=o.id,
        proveedor_id=o.proveedor_id,
        proveedor_nombre=o.proveedor.nombre if o.proveedor else None,
        usuario_solicitante_id=o.usuario_solicitante_id,
        usuario_solicitante_nombre=None,
        estado=o.estado.value if hasattr(o.estado, 'value') else str(o.estado),
        notas=o.notas,
        fecha_emision=o.fecha_emision,
        fecha_recepcion=o.fecha_recepcion,
        detalles=detalles_resp,
        lotes=lotes_resp,
        total_estimado=total_est
    )

@router.get("/ordenes-compra/{orden_id}", response_model=OrdenCompraResponse)
async def consultar_orden_compra(
    orden_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(bodega_roles)
):
    return await obtener_orden_compra_detalle(orden_id, db)

@router.post("/ordenes-compra/{orden_id}/cancelar", response_model=OrdenCompraResponse)
@router.put("/ordenes-compra/{orden_id}/cancelar", response_model=OrdenCompraResponse)
async def cancelar_orden_compra(
    orden_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(bodega_roles)
):
    orden = await db.get(OrdenCompra, orden_id)
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if orden.estado == EstadoOrdenCompra.RECIBIDA:
        raise HTTPException(status_code=400, detail="No se puede cancelar una orden ya recibida en inventario")
    if orden.estado == EstadoOrdenCompra.CANCELADA:
        raise HTTPException(status_code=400, detail="La orden ya se encuentra cancelada")
        
    orden.estado = EstadoOrdenCompra.CANCELADA

    auditoria = AuditoriaEvento(
        usuario_id=current_user.id,
        tipo_evento="CANCELACION_ORDEN_COMPRA",
        descripcion=f"Cancelación de la orden de compra {orden.id}",
        gravedad="MEDIA",
        detalle_json={"orden_id": str(orden.id)}
    )
    db.add(auditoria)

    await db.commit()
    return await obtener_orden_compra_detalle(orden_id, db)

@router.post("/ordenes-compra/{orden_id}/recibir", response_model=OrdenCompraResponse)
@router.post("/recepcion/{orden_id}", response_model=OrdenCompraResponse)
async def recibir_orden(
    orden_id: UUID,
    req: Optional[RecepcionOrdenRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(bodega_roles)
):
    """
    Recepción de mercancía. Cambia estado a RECIBIDA y crea automáticamente
    los correspondientes LoteInventario con orden_compra_id, código de lote sanitario
    generado y fecha de caducidad informada.
    """
    query = (
        select(OrdenCompra)
        .options(
            joinedload(OrdenCompra.proveedor),
            selectinload(OrdenCompra.detalles).joinedload(DetalleOrdenCompra.producto)
        )
        .where(OrdenCompra.id == orden_id)
    )
    res = await db.execute(query)
    orden = res.scalar_one_or_none()
    if not orden:
        raise HTTPException(status_code=404, detail="Orden de compra no encontrada")
        
    if orden.estado in [EstadoOrdenCompra.RECIBIDA, EstadoOrdenCompra.CANCELADA]:
        raise HTTPException(status_code=400, detail="La orden ya fue recibida en su totalidad o cancelada previamente")
        
    req_data = req or RecepcionOrdenRequest()
    lotes_creados = []
    detalles_dict = {d.producto_id: d for d in orden.detalles}
    hoy_code = datetime.utcnow().strftime("%Y%m%d")

    if req_data.items and len(req_data.items) > 0:
        for item in req_data.items:
            prod = await db.get(Producto, item.producto_id)
            if not prod:
                raise HTTPException(status_code=400, detail=f"Producto con ID {item.producto_id} no encontrado")
            
            det_orig = detalles_dict.get(item.producto_id)
            if not det_orig:
                continue

            pendiente = max(Decimal("0.00"), det_orig.cantidad_solicitada - (det_orig.cantidad_recibida or Decimal("0.00")))
            cant_ahora = item.cantidad_recibida if item.cantidad_recibida is not None else pendiente
            if cant_ahora <= Decimal("0.00"):
                continue

            # Acumular cantidad recibida en el detalle
            recibida_previa = det_orig.cantidad_recibida or Decimal("0.00")
            det_orig.cantidad_recibida = recibida_previa + cant_ahora

            costo = item.costo_unitario_real if item.costo_unitario_real is not None else (det_orig.costo_unitario_pactado if det_orig else prod.costo_base)
            
            codigo = (item.codigo_lote or "").strip()
            if not codigo:
                codigo = f"SAN-{hoy_code}-{uuid.uuid4().hex[:6].upper()}"
            
            vencimiento = item.fecha_vencimiento or req_data.fecha_vencimiento_general or (date.today() + timedelta(days=180))

            sucursal_recepcion = current_user.sucursal_id or UUID("00000000-0000-0000-0000-000000000001")
            nuevo_lote = LoteInventario(
                producto_id=item.producto_id,
                orden_compra_id=orden.id,
                codigo_lote=codigo,
                cantidad_inicial=cant_ahora,
                cantidad_disponible=cant_ahora,
                costo_unitario=costo,
                fecha_vencimiento=vencimiento,
                estado=EstadoLote.ACTIVO,
                sucursal_id=sucursal_recepcion
            )
            db.add(nuevo_lote)
            lotes_creados.append(nuevo_lote)
    else:
        # Recepción total del saldo pendiente de cada ítem
        sucursal_recepcion = current_user.sucursal_id or UUID("00000000-0000-0000-0000-000000000001")
        for det in orden.detalles:
            pendiente = max(Decimal("0.00"), det.cantidad_solicitada - (det.cantidad_recibida or Decimal("0.00")))
            if pendiente <= Decimal("0.00"):
                continue

            det.cantidad_recibida = det.cantidad_solicitada
            codigo = f"SAN-{hoy_code}-{uuid.uuid4().hex[:6].upper()}"
            vencimiento = req_data.fecha_vencimiento_general or (date.today() + timedelta(days=180))
            nuevo_lote = LoteInventario(
                producto_id=det.producto_id,
                orden_compra_id=orden.id,
                codigo_lote=codigo,
                cantidad_inicial=pendiente,
                cantidad_disponible=pendiente,
                costo_unitario=det.costo_unitario_pactado,
                fecha_vencimiento=vencimiento,
                estado=EstadoLote.ACTIVO,
                sucursal_id=sucursal_recepcion
            )
            db.add(nuevo_lote)
            lotes_creados.append(nuevo_lote)

    if not lotes_creados:
        raise HTTPException(status_code=400, detail="No se especificó ninguna cantidad válida pendiente por recibir")

    # Evaluar si la orden fue completada al 100% o quedó en entrega parcial
    todas_completadas = True
    al_menos_una_recibida = False
    for det in orden.detalles:
        recibida = det.cantidad_recibida or Decimal("0.00")
        if recibida > Decimal("0.00"):
            al_menos_una_recibida = True
        if recibida < det.cantidad_solicitada:
            todas_completadas = False

    if todas_completadas:
        orden.estado = EstadoOrdenCompra.RECIBIDA
    elif al_menos_una_recibida:
        orden.estado = EstadoOrdenCompra.RECIBIDA_PARCIAL

    orden.fecha_recepcion = datetime.utcnow()
    if req_data.notas:
        orden.notas = f"{orden.notas or ''} | Recepción: {req_data.notas}".strip(" |")
    
    es_parcial = orden.estado == EstadoOrdenCompra.RECIBIDA_PARCIAL
    auditoria = AuditoriaEvento(
        usuario_id=current_user.id,
        tipo_evento="RECEPCION_ORDEN_COMPRA_PARCIAL" if es_parcial else "RECEPCION_ORDEN_COMPRA_TOTAL",
        descripcion=f"Recepción {'parcial' if es_parcial else 'completa'} de orden {orden.id}: {len(lotes_creados)} lotes ingresados",
        gravedad="INFO",
        detalle_json={
            "orden_id": str(orden.id),
            "estado_resultante": orden.estado.value,
            "total_lotes_generados": len(lotes_creados),
            "lotes": [l.codigo_lote for l in lotes_creados]
        }
    )
    db.add(auditoria)
    
    await db.commit()
    return await obtener_orden_compra_detalle(orden.id, db)

@router.get("/alertas-caducidad", response_model=List[LoteResponse])
async def alertas_caducidad(
    dias_alerta: int = 30,
    sucursal_id: Optional[UUID] = Query(None, description="Filtrar alertas por sucursal"),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(bodega_roles)
):
    fecha_limite = date.today() + timedelta(days=dias_alerta)
    sucursal_efectiva = enforce_sucursal_scope(current_user, sucursal_id)
    
    query = (
        select(LoteInventario, Producto.nombre.label("producto_nombre"), Producto.sku.label("producto_sku"))
        .join(Producto, LoteInventario.producto_id == Producto.id)
        .where(
            LoteInventario.estado == EstadoLote.ACTIVO,
            LoteInventario.fecha_vencimiento <= fecha_limite,
            LoteInventario.cantidad_disponible > 0
        )
    )
    if sucursal_efectiva:
        query = query.where(LoteInventario.sucursal_id == sucursal_efectiva)
        
    query = query.order_by(LoteInventario.fecha_vencimiento.asc())
    
    result = await db.execute(query)
    rows = result.all()
    
    return [
        LoteResponse(
            id=lote.id,
            producto_id=lote.producto_id,
            producto_nombre=prod_nom,
            producto_sku=prod_sku,
            codigo_lote=lote.codigo_lote,
            cantidad_inicial=lote.cantidad_inicial,
            cantidad_disponible=lote.cantidad_disponible,
            costo_unitario=lote.costo_unitario,
            fecha_ingreso=lote.fecha_ingreso,
            fecha_vencimiento=lote.fecha_vencimiento,
            estado=lote.estado.value if hasattr(lote.estado, 'value') else str(lote.estado)
        )
        for lote, prod_nom, prod_sku in rows
    ]
