from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.oltp import get_db
from app.models.usuarios import Usuario
from app.schemas.auth import TokenPayload

# Configura Swagger para que entienda de dónde sacar el token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> Usuario:
    """Extrae, valida el JWT y devuelve el objeto Usuario desde la base de datos"""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
        
        if token_data.sub is None:
            raise HTTPException(status_code=403, detail="Token no contiene ID de usuario")
            
    except (jwt.JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No se pudieron validar las credenciales",
        )
        
    result = await db.execute(
        select(Usuario).options(selectinload(Usuario.sucursal)).where(Usuario.id == token_data.sub)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if not user.activo:
        raise HTTPException(status_code=400, detail="El usuario está inactivo")
        
    return user


class RoleChecker:
    """Validador dinámico de roles (RBAC)"""
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: Usuario = Depends(get_current_user)):
        # Asumiendo que user.rol es un Enum, lo pasamos a string para comparar
        if user.rol.name not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permisos insuficientes para realizar esta acción"
            )
        return user


def enforce_sucursal_scope(user: Usuario, requested_sucursal_id: Optional[UUID] = None) -> Optional[UUID]:
    """
    Seguridad y Aislamiento por Sede:
    - DIRECTOR: Acceso global. Si pasa requested_sucursal_id filtra por esa sede; si pasa None, acceso global sin filtrar.
    - OTROS ROLES (SUPERVISOR, CAJERO, BODEGUERO): Limitados estrictamente a su sucursal_id asignada.
      Si intentan solicitar datos de otra sucursal diferente a la suya, se deniega con 403 Forbidden.
      Si no pasan requested_sucursal_id, se fuerza automáticamente a su sucursal_id asignada.
    """
    rol_str = user.rol.value if hasattr(user.rol, 'value') else str(user.rol)
    if rol_str != "DIRECTOR":
        user_suc = getattr(user, "sucursal_id", None)
        if user_suc is None:
            return requested_sucursal_id
        if requested_sucursal_id is not None and requested_sucursal_id != user_suc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acceso denegado: Tu perfil está restringido exclusivamente a las operaciones de tu sucursal asignada"
            )
        return user_suc
    return requested_sucursal_id

