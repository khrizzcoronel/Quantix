from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import List, Optional
from uuid import UUID

from app.db.oltp import get_db
from app.api.deps import RoleChecker, get_current_user
from app.core.security import get_password_hash, verify_password
from app.models.usuarios import Usuario, RolUsuario
from app.schemas.usuarios import UsuarioCreate, UsuarioUpdate, UsuarioResponse, AvatarUpdate, PerfilUpdate

router = APIRouter()

director_only = RoleChecker(["DIRECTOR"])
director_o_supervisor = RoleChecker(["DIRECTOR", "SUPERVISOR"])

@router.get("", response_model=List[UsuarioResponse])
async def listar_usuarios(
    activo_only: bool = Query(False, description="Filtrar solo usuarios activos"),
    rol: Optional[str] = Query(None, description="Filtrar por rol"),
    q: Optional[str] = Query(None, description="Búsqueda por nombre o correo"),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(director_o_supervisor)
):
    """
    Lista todos los usuarios operadores del sistema.
    """
    query = select(Usuario)
    if activo_only:
        query = query.where(Usuario.activo == True)
    if rol:
        try:
            rol_enum = RolUsuario[rol.upper()]
            query = query.where(Usuario.rol == rol_enum)
        except KeyError:
            raise HTTPException(status_code=400, detail=f"Rol no válido: {rol}")
    if q:
        termino = f"%{q.strip()}%"
        query = query.where(
            or_(
                Usuario.nombre.ilike(termino),
                Usuario.email.ilike(termino)
            )
        )
    query = query.order_by(Usuario.nombre.asc())
    result = await db.execute(query)
    usuarios = result.scalars().all()
    
    return [
        UsuarioResponse(
            id=u.id,
            nombre=u.nombre,
            email=u.email,
            rol=u.rol.value if hasattr(u.rol, 'value') else str(u.rol),
            activo=u.activo,
            avatar=u.avatar,
            telefono=u.telefono,
            creado_en=u.creado_en
        )
        for u in usuarios
    ]

@router.get("/me", response_model=UsuarioResponse)
async def obtener_mi_perfil(current_user: Usuario = Depends(get_current_user)):
    return UsuarioResponse(
        id=current_user.id,
        nombre=current_user.nombre,
        email=current_user.email,
        rol=current_user.rol.value if hasattr(current_user.rol, 'value') else str(current_user.rol),
        activo=current_user.activo,
        avatar=current_user.avatar,
        telefono=current_user.telefono,
        creado_en=current_user.creado_en
    )

@router.put("/me", response_model=UsuarioResponse)
async def actualizar_mi_perfil(
    req: PerfilUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    if req.email is not None and req.email != current_user.email:
        existente = await db.execute(
            select(Usuario).where(Usuario.email == req.email, Usuario.id != current_user.id)
        )
        if existente.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Ya existe otro usuario con este correo electrónico")
        current_user.email = req.email

    if req.nombre is not None:
        current_user.nombre = req.nombre

    if req.telefono is not None:
        current_user.telefono = req.telefono

    if req.avatar is not None:
        current_user.avatar = req.avatar

    if req.password_nuevo is not None:
        if not req.password_actual or not verify_password(req.password_actual, current_user.password_hash):
            raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")
        current_user.password_hash = get_password_hash(req.password_nuevo)

    await db.commit()
    await db.refresh(current_user)

    return UsuarioResponse(
        id=current_user.id,
        nombre=current_user.nombre,
        email=current_user.email,
        rol=current_user.rol.value if hasattr(current_user.rol, 'value') else str(current_user.rol),
        activo=current_user.activo,
        avatar=current_user.avatar,
        telefono=current_user.telefono,
        creado_en=current_user.creado_en
    )

@router.get("/{usuario_id}", response_model=UsuarioResponse)
async def obtener_usuario(
    usuario_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(director_o_supervisor)
):
    u = await db.get(Usuario, usuario_id)
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return UsuarioResponse(
        id=u.id,
        nombre=u.nombre,
        email=u.email,
        rol=u.rol.value if hasattr(u.rol, 'value') else str(u.rol),
        activo=u.activo,
        avatar=u.avatar,
        telefono=u.telefono,
        creado_en=u.creado_en
    )

@router.post("", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
async def crear_usuario(
    req: UsuarioCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(director_only)
):
    """
    Crea un nuevo usuario con credenciales encriptadas (Solo Director).
    """
    existente = await db.execute(select(Usuario).where(Usuario.email == req.email))
    if existente.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe un usuario con este correo electrónico")
    
    try:
        rol_enum = RolUsuario[req.rol.upper()]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Rol inválido: {req.rol}")

    nuevo_usuario = Usuario(
        nombre=req.nombre,
        email=req.email,
        password_hash=get_password_hash(req.password),
        rol=rol_enum,
        activo=True,
        telefono=req.telefono
    )
    db.add(nuevo_usuario)
    await db.commit()
    await db.refresh(nuevo_usuario)

    return UsuarioResponse(
        id=nuevo_usuario.id,
        nombre=nuevo_usuario.nombre,
        email=nuevo_usuario.email,
        rol=nuevo_usuario.rol.value if hasattr(nuevo_usuario.rol, 'value') else str(nuevo_usuario.rol),
        activo=nuevo_usuario.activo,
        avatar=nuevo_usuario.avatar,
        telefono=nuevo_usuario.telefono,
        creado_en=nuevo_usuario.creado_en
    )

@router.put("/{usuario_id}", response_model=UsuarioResponse)
async def actualizar_usuario(
    usuario_id: UUID,
    req: UsuarioUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(director_only)
):
    """
    Modifica datos, contraseña o estado de un usuario (Solo Director).
    """
    u = await db.get(Usuario, usuario_id)
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if req.email is not None:
        duplicado = await db.execute(
            select(Usuario).where(Usuario.email == req.email, Usuario.id != usuario_id)
        )
        if duplicado.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Ya existe otro usuario con este correo")
        u.email = req.email

    if req.nombre is not None:
        u.nombre = req.nombre

    if req.password is not None and req.password.strip():
        u.password_hash = get_password_hash(req.password)

    if req.rol is not None:
        try:
            u.rol = RolUsuario[req.rol.upper()]
        except KeyError:
            raise HTTPException(status_code=400, detail=f"Rol inválido: {req.rol}")

    if req.activo is not None:
        u.activo = req.activo

    if req.telefono is not None:
        u.telefono = req.telefono

    await db.commit()
    await db.refresh(u)

    return UsuarioResponse(
        id=u.id,
        nombre=u.nombre,
        email=u.email,
        rol=u.rol.value if hasattr(u.rol, 'value') else str(u.rol),
        activo=u.activo,
        avatar=u.avatar,
        telefono=u.telefono,
        creado_en=u.creado_en
    )

@router.put("/{usuario_id}/avatar", response_model=UsuarioResponse)
async def actualizar_avatar_usuario(
    usuario_id: UUID,
    req: AvatarUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Actualiza la foto de perfil en Base64 de un usuario.
    Permite al propio usuario o a un Director realizar el cambio.
    """
    es_propio = (current_user.id == usuario_id)
    rol_str = current_user.rol.value if hasattr(current_user.rol, 'value') else str(current_user.rol)
    es_director = (rol_str == "DIRECTOR")

    if not (es_propio or es_director):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para modificar este avatar"
        )

    u = await db.get(Usuario, usuario_id)
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    u.avatar = req.avatar
    await db.commit()
    await db.refresh(u)

    return UsuarioResponse(
        id=u.id,
        nombre=u.nombre,
        email=u.email,
        rol=u.rol.value if hasattr(u.rol, 'value') else str(u.rol),
        activo=u.activo,
        avatar=u.avatar,
        telefono=u.telefono,
        creado_en=u.creado_en
    )

@router.delete("/{usuario_id}", response_model=UsuarioResponse)
async def baja_logica_usuario(
    usuario_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(director_only)
):
    """
    Baja lógica: Desactiva al usuario para revocar su acceso sin borrar su historial ni auditorías.
    """
    if current_user.id == usuario_id:
        raise HTTPException(status_code=400, detail="No puedes desactivar tu propio usuario director en sesión activa")

    u = await db.get(Usuario, usuario_id)
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    u.activo = False
    await db.commit()
    await db.refresh(u)

    return UsuarioResponse(
        id=u.id,
        nombre=u.nombre,
        email=u.email,
        rol=u.rol.value if hasattr(u.rol, 'value') else str(u.rol),
        activo=u.activo,
        avatar=u.avatar,
        telefono=u.telefono,
        creado_en=u.creado_en
    )
