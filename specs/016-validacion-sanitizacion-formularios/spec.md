# Especificación Funcional: 016 - Gobernanza de Datos de Entrada, Validación Local y Formularios Accesibles

**Módulo:** 016-validacion-sanitizacion-formularios  
**Nivel Organizacional:** Transversal (Calidad de Datos, Seguridad y Ergonomía UI/UX)  
**Estado:** IMPLEMENTADO / VERIFICADO  
**Dependencias:** Ninguna (Capa de Utilidades y Hooks de Frontend)  
**Archivos Fuente:** `frontend/src/utils/validation.ts`, `frontend/src/hooks/useFormValidation.ts`  

---

## 1. Declaración del Problema y Objetivos
La captura de datos erróneos en los formularios del sistema (cédulas o RUCs inválidos, códigos de barras corruptos, contraseñas débiles o fechas de caducidad inconsistentes) degrada la integridad contable, rompe la trazabilidad sanitaria FEFO y sobrecarga al backend con validaciones fallidas. Asimismo, formularios que no informan claramente los errores o no autoenfocan los campos deficientes ralentizan al operador en piso de venta.

Este módulo implementa el subsistema de validación, sanitización y formularios accesibles de Quantix:
* **Validación Algorítmica de Documentos de Identidad (Ecuador):**
  - **Cédula de Identidad:** Validación estricta mediante el **Algoritmo Módulo 10**, comprobando provincia emisora válida (01 a 24 y 30 para ecuatorianos en el exterior), tercer dígito $< 6$ y dígito verificador.
  - **RUC Persona Natural:** Validación de los 10 primeros dígitos con Módulo 10 y sufijo de establecimiento activo (`001` o superior).
  - **RUC Sociedad Pública / Jurídica:** Soporte para coeficientes ponderados específicos según el tercer dígito (6 o 9).
* **Validación de Códigos de Barras EAN-13:** Verificación algorítmica de 13 dígitos mediante suma ponderada alternada ($\times 1$ en impares y $\times 3$ en pares) y comprobación del dígito verificador final.
* **Medidor de Entropía y Fortaleza de Contraseñas:** Evaluación multicriterio en tiempo real (mínimo 6 caracteres, longitud recomendada $\ge 8$, presencia de mayúsculas, minúsculas, dígitos y caracteres especiales) clasificando la fuerza en: `DÉBIL`, `REGULAR`, `FUERTE`, `MUY FUERTE`.
* **Reglas Sanitarias FEFO en Fechas de Vencimiento:** Validación obligatoria de fechas futuras en la recepción o registro de lotes de inventario, impidiendo la captura de mercancía ya caducada.
* **Ciclo de Vida y Accesibilidad del Hook `useFormValidation`:**
  - Validación configurable por campo: en cambio (`onChange`), al perder el foco (`onBlur`) o al intentar el envío definitivo (`onSubmit`).
  - Autoenfoque accesible (`autoFocusOnError`): enfoca automáticamente el primer campo defectuoso en el DOM para usuarios con teclado o lectores de pantalla.
  - Mapeo automático de errores del backend: traduce de forma transparente las respuestas de FastAPI HTTP 422 (`ValidationError` con array `loc` y `msg`) o errores 400/409 directamente a los campos correspondientes del formulario.

---

## 2. Historias de Usuario y Criterios de Aceptación Verificados

### Historia 1: Validación Instantánea de Cédula Ecuatoriana con Módulo 10
* **Como** cajero que da de alta a un cliente rápido,  
* **Quiero** que el campo valide inmediatamente la validez matemática de la cédula al escribirla,  
* **Para** no registrar números falsos ni clientes duplicados por error tipográfico.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Cédula válida con dígito verificador correcto
  Dado el número de cédula "1710034065" (provincia 17 válida y suma módulo 10 coincidente)
  Cuando el usuario escribe o pierde el foco en el campo
  Entonces validarCedulaEcuador() devuelve { esValido: true, error: null }
  Y el formulario no muestra advertencias de bloqueo.

Escenario: Cédula con provincia inválida o suma incorrecta
  Dado el número "9912345678" (código de provincia 99 inexistente)
  Cuando el usuario ingresa el valor
  Entonces la validación falla con el mensaje "El código de provincia de la cédula es inválido"
  Y el botón de guardado permanece deshabilitado.
```

### Historia 2: Validación de Código de Barras EAN-13
* **Como** encargado de catálogo en Inventario,  
* **Quiero** que al crear o editar un producto se valide el dígito verificador del código de barras,  
* **Para** asegurar que el escáner del punto de venta pueda leerlo sin fallas.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Código EAN-13 válido
  Dado el código de barras "7501055365440"
  Cuando se ejecuta validarCodigoBarrasEAN13()
  Entonces la suma ponderada alternada valida que el dígito 0 final es exacto
  Y permite el guardado del producto.
```

### Historia 3: Autoenfoque Accesible y Mapeo de Errores de Servidor
* **Como** operador del sistema,  
* **Quiero** que al fallar un formulario el cursor salte de inmediato al primer campo con error,  
* **Para** corregir los datos ágilmente sin tener que buscar con el ratón.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Manejo de errores HTTP 422 de Pydantic
  Dado un formulario de alta de usuario con contraseña corta y correo inválido
  Cuando el backend FastAPI responde con HTTP 422 conteniendo detalles de validación
  Entonces setErrorsFromBackend() mapea los mensajes a los campos "password" y "email"
  Y el hook useFormValidation enfoca automáticamente el campo "email" en el navegador.
```

---

## 3. Requisitos No Funcionales del Módulo
* **Rendimiento de Validación:** Toda función de validación algorítmica se ejecuta en $\le 1$ milisegundo en el hilo principal del navegador.
* **Accesibilidad Web (WCAG 2.1 AA):** Los campos con error vinculan sus mensajes mediante el atributo `aria-describedby` y actualizan `aria-invalid="true"`.
