# Quickstart: Validación de Formularios (Módulo 016)

Guía rápida de integración del sistema de validación y hook accesible en componentes React.

## 1. Uso de Validadores Puros

```typescript
import { validarCedulaEcuador, validarCodigoBarrasEAN13, evaluarFortalezaPassword } from '../utils/validation';

// Validar cédula
const resCedula = validarCedulaEcuador('1710034065');
if (!resCedula.esValido) {
  console.error(resCedula.error);
}

// Evaluar contraseña
const fuerza = evaluarFortalezaPassword('Secret123!');
console.log(fuerza.fuerza); // 'FUERTE'
```

## 2. Integración en un Formulario con `useFormValidation`

```tsx
import React from 'react';
import { useFormValidation } from '../hooks/useFormValidation';
import { validarRequerido, validarEmail, validarCedulaEcuador } from '../utils/validation';

export function FormularioCliente() {
  const { values, errors, handleChange, handleBlur, validateAll, setErrorsFromBackend } = useFormValidation({
    initialValues: { nombre: '', cedula: '', email: '' },
    validationRules: {
      nombre: [validarRequerido('El nombre es obligatorio')],
      cedula: [validarRequerido('La cédula es requerida'), validarCedulaEcuador],
      email: [validarEmail('Correo inválido')],
    },
    validateOn: 'onBlur',
    autoFocusOnError: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;

    try {
      await api.post('/crm/clientes', values);
    } catch (err: any) {
      if (err.response?.status === 422) {
        setErrorsFromBackend(err.response.data);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="cedula"
        value={values.cedula}
        onChange={(e) => handleChange('cedula', e.target.value)}
        onBlur={() => handleBlur('cedula')}
      />
      {errors.cedula && <span className="text-red-500">{errors.cedula}</span>}
      <button type="submit">Guardar</button>
    </form>
  );
}
```
