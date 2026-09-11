# Especificación Funcional: 010 - Autenticación, JWT, Matriz de Roles (RBAC) y Aislamiento Multi-Sede

**Módulo:** 010-auth-usuarios  
**Nivel Organizacional:** Transversal (Seguridad y Gobernanza de Identidades)  
**Estado:** IMPLEMENTADO / VERIFICADO  
**Dependencias:** 001-core-ventas-inventario  

---

## 1. Declaración del Problema y Objetivos
El acceso a un sistema comercial minorista distribuido exige una estricta segregación de funciones (RBAC) basada en la Pirámide Organizacional de Anthony. Además de la autenticación segura, el sistema debe garantizar el aislamiento estricto de información por sucursal física para evitar filtraciones y accesos no autorizados entre tiendas.

Este módulo implementa la seguridad centralizada de Quantix:
* Autenticación basada en JSON Web Tokens (JWT) firmados mediante algoritmo HMAC-SHA256 con expiración de sesión.
* Cifrado unidireccional de contraseñas mediante `bcrypt` con costo adaptativo.
* Catálogo formal de 4 roles de usuario: `DIRECTOR`, `SUPERVISOR`, `CAJERO`, `BODEGUERO`.
* Modelo de usuario enriquecido con campos de contacto (`telefono`, Alembic 0005), foto de perfil (`avatar`) y sede de adscripción (`sucursal_id`, Alembic 0008).
* **Aislamiento Multi-Sede Estricto (`enforce_sucursal_scope`):** Todo usuario con rol distinto a `DIRECTOR` queda confinado obligatoriamente a los datos y operaciones de su propia sucursal asignada. Cualquier intento de consulta o manipulación foránea se deniega de forma determinista con **HTTP 403 Forbidden**.
* **Autorización Supervisada en Caliente (`POST /api/v1/auth/supervisor-override`):** Modal de override para anular ventas, autorizar descuentos o cerrar turnos descuadrados mediante credenciales de supervisor en la terminal.
* Gestión completa de directorio de usuarios con altas, bajas lógicas (`activo = false`) y reseteo de claves.

---

## 2. Matriz de Roles y Superficie de Acceso (RBAC)

| Módulo / Funcionalidad | Cajero | Bodeguero | Supervisor | Director | Aislamiento de Sucursal |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Login (`/login`)** | Acceso | Acceso | Acceso | Acceso | Público |
| **Punto de Venta (`/pos`)** | Pleno | — | Pleno + Override | Pleno | Confinado a sucursal activa |
| **Clientes & Cupones (`/clientes`)** | Alta/Consulta | — | Gestión Local | Global | Supervisor confinado a su sede |
| **Inventario & FEFO (`/inventario`)** | — | Pleno | Pleno | Pleno | Confinado a stock de sucursal |
| **Transferencias de Stock** | — | Despacho/Recepción | Autorización | Pleno | Confinado a origen/destino |
| **Supervisión de Cajas (`/tactico`)** | — | — | Turnos de su Sede | Global | Supervisor confinado a su sede |
| **Directorio Usuarios (`/usuarios`)** | — | — | Solo su Sede | CRUD Total | Supervisor solo ve su equipo |
| **Tableros BI (`/dashboard`, `/analisis`)**| — | — | Solo su Sede | Multi-sede Total | Supervisor bloqueado con candado |
| **Operaciones & ETL (`/operaciones`)** | — | — | — | Pleno | Reservado a Director |
| **Configuración (`/configuracion`)** | — | — | — | Pleno | Reservado a Director |

---

## 3. Historias de Usuario y Criterios de Aceptación Verificados

### Historia 1: Autenticación JWT y Apertura de Contexto
```gherkin
Escenario: Login exitoso de Cajero
  Dado credenciales válidas de un usuario con rol CAJERO vinculado a Sucursal Norte
  Cuando envía POST /api/v1/auth/login
  Entonces el sistema responde con access_token JWT, rol = CAJERO y sucursal_id = norte_uuid
  Y el frontend inicializa authStore y redirige a la vista de Punto de Venta.
```

### Historia 2: Denegación HTTP 403 por Intento de Acceso Cross-Branch
```gherkin
Escenario: Supervisor intentando consultar datos de otra tienda
  Dado un usuario autenticado con rol SUPERVISOR asignado a Sucursal Norte
  Cuando intenta consultar GET /crm/clientes?sucursal_id=matriz_uuid
  Entonces la dependencia enforce_sucursal_scope intercepta la solicitud
  Y responde inmediatamente con HTTP 403 Forbidden
  Y el mensaje declara "Acceso denegado: Tu perfil está restringido exclusivamente a las operaciones de tu sucursal asignada".
```

### Historia 3: Supervisor Override en Caliente
```gherkin
Escenario: Autorización de anulación en caja
  Dado un cajero que solicita anular un ticket
  Cuando el supervisor digita su correo y contraseña en el modal de override
  Entonces el backend valida en POST /api/v1/auth/supervisor-override que el rol sea SUPERVISOR o DIRECTOR
  Y emite un token de autorización temporal
  Y registra el evento en auditoria_evento vinculando al supervisor autorizador.
```

---

## 4. Requisitos No Funcionales del Módulo
* **Expiración de Token:** JWT con tiempo de vida configurado a 12 horas para turnos comerciales.
* **Seguridad de Passwords:** Costo mínimo de 12 rondas en `bcrypt`.
* **CORS:** Configuración explícita de orígenes autorizados, impidiendo peticiones no autorizadas de orígenes externos.
