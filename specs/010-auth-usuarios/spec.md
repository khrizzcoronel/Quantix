# Especificación Funcional: 010 - Autenticación, JWT y RBAC

**Módulo:** 010-auth-usuarios  
**Dependencias:** 001 (Core), Base de datos PostgreSQL  

## 1. Objetivo
Asegurar el sistema Quantix mediante autenticación por token (JWT) y proteger **todas** las rutas de la API (excepto el login). Se configurarán estrictamente las políticas de CORS para permitir la comunicación segura entre el frontend React local/producción y el backend FastAPI.

## 2. Historias de Usuario
* **Como** cajero, **quiero** iniciar sesión con mi email y PIN/contraseña **para** poder abrir el turno de caja.
* **Como** supervisor, **quiero** autenticar una anulación en la terminal del cajero ingresando mi credencial, **para** autorizar operaciones críticas.

## 3. Criterios Técnicos y Reglas (CORS & Auth)
1. **Hash de contraseñas:** Obligatorio el uso de `Argon2id` o `bcrypt`.
2. **CORS:** El backend debe incluir `CORSMiddleware` explícito documentando los orígenes permitidos, métodos (`*`) y headers (`Authorization`, `Content-Type`) para evitar bloqueos del navegador web.
3. **JWT:** Expiración de 12 horas para el token de acceso. Contiene el `id` y el `rol` del usuario.
