# Modelo de Datos: 010 - Autenticación, JWT y RBAC

Este módulo no introduce nuevas tablas a la base de datos, sino que se apoya en las tablas ya existentes en el esquema:

- **`usuario`**: Utilizada para validar las credenciales (email y contraseña/PIN) durante el proceso de autenticación (`login`) y para la sobreescritura de supervisor (`supervisor-override`). De esta tabla se extrae el rol y el ID del usuario para inyectarlos en el token JWT.
- **`sesion_caja`**: Utilizada de forma indirecta, ya que el proceso de inicio de sesión de un cajero es un prerrequisito para poder interactuar con la apertura de turnos en `sesion_caja`.

La información de autenticación como tal (tokens JWT) es *stateless* y no se almacena en la base de datos.
