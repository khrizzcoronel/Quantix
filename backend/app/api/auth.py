from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.oltp import get_db
from app.core.security import verify_password, create_access_token
from app.models.usuarios import Usuario
from app.schemas.auth import Token, SupervisorOverrideRequest

router = APIRouter()

@router.post("/login", response_model=Token)
async def login_access_token(
    db: AsyncSession = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> dict:
    """
    OAuth2 compatible token login, requiere username (email) y password.
    """
    result = await db.execute(select(Usuario).where(Usuario.email == form_data.username))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email o contraseña incorrectos"
        )
    if not user.activo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario inactivo no puede iniciar sesión"
        )
        
    access_token = create_access_token(subject=user.id, rol=user.rol.name)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/supervisor-override")
async def supervisor_override(
    req: SupervisorOverrideRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Endpoint (RF-SEG-03) utilizado en caliente durante una sesión de caja
    para autorizar anulaciones sin desloguear al cajero actual.
    """
    result = await db.execute(select(Usuario).where(Usuario.email == req.email))
    supervisor = result.scalar_one_or_none()
    
    if not supervisor or not verify_password(req.password, supervisor.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales de supervisor incorrectas"
        )
        
    if supervisor.rol.name not in ["SUPERVISOR", "DIRECTOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario provisto no tiene privilegios de autorización"
        )
        
    # Notificación WebSocket asíncrona si la caja estuviera conectada al canal
    from app.api.ws import notif_manager
    import asyncio
    
    # En un caso real, la terminal del cajero se suscribiría con su propio ID
    # Simulación: Mandamos el push al ID del cajero que lo solicitó (req.cajero_id en un esquema avanzado)
    # Por simplicidad aquí lo mandamos como log conceptual:
    # await notif_manager.send_personal_message({"tipo": "AUTORIZACION", "estado": "APROBADA"}, "CAJERO_ID")

    return {
        "autorizado": True,
        "supervisor_id": supervisor.id,
        "mensaje": "Operación autorizada exitosamente"
    }
