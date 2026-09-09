# Lista de Tareas: 010 - Auth y CORS

- [x] **TASK-010-01**: Implementar `CORSMiddleware` en `main.py` especificando orígenes, métodos y cabeceras permitidas.
- [x] **TASK-010-02**: Crear endpoint `POST /api/v1/auth/login` para recibir credenciales, validarlas contra la tabla `usuario` y retornar el token JWT.
- [x] **TASK-010-03**: Configurar y generar JWT (con expiración de 12 horas, conteniendo `id` y `rol`).
- [x] **TASK-010-04**: Implementar verificador RBAC (`RoleChecker`) y dependencias (`get_current_active_user`) para proteger endpoints.
- [x] **TASK-010-05**: Implementar endpoint `POST /api/v1/auth/supervisor-override` protegido por JWT y con auditoría del autorizador.
