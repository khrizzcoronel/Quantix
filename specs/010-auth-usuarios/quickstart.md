# Guía Rápida: 010 - Autenticación

A continuación se muestran ejemplos de cómo interactuar con los endpoints de autenticación utilizando `curl`.

## 1. Hacer Login y Obtener JWT

Para iniciar sesión y obtener el token de acceso, puedes hacer la siguiente petición. Nota que FastAPI espera que los datos vengan en formato `application/x-www-form-urlencoded`.

```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "username=cajero@quantix.local&password=mipassword"
```

Si las credenciales son correctas, recibirás una respuesta como esta:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5c...",
  "token_type": "bearer"
}
```

## 2. Usar el JWT en una Petición Protegida

Una vez que tengas el `access_token`, puedes usarlo en los headers de autorización para acceder a endpoints protegidos:

```bash
curl -X GET "http://localhost:8000/api/v1/usuarios/me" \
     -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5c..."
```

## 3. Autorización Rápida de Supervisor (Supervisor Override)

Si un cajero está logueado pero necesita autorización para una acción crítica, el supervisor puede ingresar sus credenciales mediante este endpoint.

```bash
curl -X POST "http://localhost:8000/api/v1/auth/supervisor-override" \
     -H "Content-Type: application/json" \
     -d '{"email": "supervisor@quantix.local", "password": "superpassword"}'
```
