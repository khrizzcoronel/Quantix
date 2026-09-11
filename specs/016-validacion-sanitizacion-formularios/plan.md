# Plan de Implementación: 016 - Validación, Sanitización y Formularios Accesibles

## Fases de Implementación

### Fase 1: Biblioteca de Validaciones Puras (`validation.ts`)
- [x] Implementar algoritmo Módulo 10 para Cédula y RUC de Ecuador (provincias 01-24 y 30).
- [x] Implementar algoritmo de dígito verificador para código de barras EAN-13.
- [x] Implementar evaluador de entropía y fortaleza de contraseñas (longitud, mayúsculas, dígitos, caracteres especiales).
- [x] Implementar validadores de fechas sanitarias FEFO (fechas futuras obligatorias para lotes).
- [x] Implementar sanitizadores de cadenas (eliminación de espacios, caracteres de control y formato de teléfono).

### Fase 2: Hook React de Gestión de Formularios (`useFormValidation.ts`)
- [x] Desarrollar hook con estado centralizado de valores, errores, campos tocados y validez general.
- [x] Soportar modos de validación `onChange`, `onBlur` y `onSubmit`.
- [x] Implementar autoenfoque accesible al primer campo con error en el DOM.
- [x] Implementar método `setErrorsFromBackend` para mapear respuestas HTTP 422 de Pydantic/FastAPI directamente a los campos.

### Fase 3: Pruebas Unitarias y Accesibilidad
- [x] Escribir suite de pruebas unitarias para `validation.ts` cubriendo cédulas válidas, inválidas, casos de borde y EAN-13.
- [x] Escribir pruebas para el hook `useFormValidation.ts` validando el ciclo de vida y foco.
- [x] Asegurar atributos ARIA (`aria-invalid`, `aria-describedby`) en componentes de formulario.
