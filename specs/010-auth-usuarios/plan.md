# Plan de Implementación: 010 - Auth y CORS

## 1. Arquitectura de Seguridad
* **Framework:** `passlib` (bcrypt) y `PyJWT`.
* **Middlewares:** `CORSMiddleware` en `main.py`.
* **Dependencias de FastAPI:** `Depends(get_current_user)` y `Depends(RoleChecker(['SUPERVISOR']))`.

## 2. Configuración CORS Obligatoria
```python
# main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], # Vite dev server
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
```

## 3. Tareas a Ejecutar
- [ ] **TASK-010-01:** Implementar configuración de CORS en `main.py`.
- [ ] **TASK-010-02:** Crear `POST /api/v1/auth/login` (recibe form-data, devuelve `access_token` y `token_type="bearer"`).
- [ ] **TASK-010-03:** Implementar utilidad `security.py` con `verify_password`, `get_password_hash` y `create_access_token`.
- [ ] **TASK-010-04:** Implementar dependencias de inyección `get_current_active_user` y verificador de RBAC (`RoleChecker`).
- [ ] **TASK-010-05:** Implementar endpoint `POST /api/v1/auth/supervisor-override` (autorización en caliente sin cerrar la sesión del cajero actual).
