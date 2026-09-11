# Especificación de Algoritmos: 016 - Validación y Gobernanza de Formularios

**Módulo:** 016-validacion-sanitizacion-formularios  
**Ámbito:** Lógica de Validación y Sanitización en Frontend (`validation.ts` y `useFormValidation.ts`)

---

## 1. Algoritmo Módulo 10 para Cédula de Identidad (Ecuador)

```typescript
export function validarCedulaEcuador(cedula: string): ValidationResult {
  const limpia = cedula.trim().replace(/\D/g, '');
  
  // 1. Longitud exacta de 10 dígitos
  if (limpia.length !== 10) {
    return { esValido: false, error: 'La cédula debe tener exactamente 10 dígitos' };
  }
  
  // 2. Validación de código de provincia (01 a 24, o 30 para ecuatorianos en el exterior)
  const provincia = parseInt(limpia.substring(0, 2), 10);
  if ((provincia < 1 || provincia > 24) && provincia !== 30) {
    return { esValido: false, error: 'El código de provincia es inválido' };
  }
  
  // 3. Tercer dígito de persona natural (menor a 6)
  const tercerDigito = parseInt(limpia[2], 10);
  if (tercerDigito >= 6) {
    return { esValido: false, error: 'El tercer dígito de la cédula es inválido' };
  }
  
  // 4. Algoritmo Módulo 10 con coeficientes alternados [2, 1, 2, 1, 2, 1, 2, 1, 2]
  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let valor = parseInt(limpia[i], 10) * coeficientes[i];
    if (valor >= 10) {
      valor -= 9;
    }
    suma += valor;
  }
  
  const digitoVerificadorCalculado = (10 - (suma % 10)) % 10;
  const digitoVerificadorReal = parseInt(limpia[9], 10);
  
  if (digitoVerificadorCalculado !== digitoVerificadorReal) {
    return { esValido: false, error: 'El dígito verificador de la cédula es incorrecto' };
  }
  
  return { esValido: true, error: null };
}
```

---

## 2. Algoritmo de Dígito Verificador EAN-13

```typescript
export function validarCodigoBarrasEAN13(codigo: string): ValidationResult {
  const limpia = codigo.trim().replace(/\D/g, '');
  if (limpia.length !== 13) {
    return { esValido: false, error: 'El código EAN-13 debe tener exactamente 13 dígitos' };
  }
  
  let suma = 0;
  // Ponderación: índices impares (0, 2, 4...) factor 1, índices pares factor 3
  for (let i = 0; i < 12; i++) {
    const digito = parseInt(limpia[i], 10);
    suma += (i % 2 === 0) ? digito : digito * 3;
  }
  
  const verificadorCalculado = (10 - (suma % 10)) % 10;
  const verificadorReal = parseInt(limpia[12], 10);
  
  if (verificadorCalculado !== verificadorReal) {
    return { esValido: false, error: 'El dígito verificador EAN-13 es incorrecto' };
  }
  
  return { esValido: true, error: null };
}
```

---

## 3. Tipos y Esquema del Hook `useFormValidation`

```typescript
export interface ReglasValidacion<T> {
  [campo: string]: Array<(valor: any, formValues: T) => string | null>;
}

export interface FormValidationState<T> {
  values: T;
  errors: Record<keyof T, string | null>;
  touched: Record<keyof T, boolean>;
  isValid: boolean;
  isSubmitting: boolean;
  handleChange: (campo: keyof T, valor: any) => void;
  handleBlur: (campo: keyof T) => void;
  validateField: (campo: keyof T) => boolean;
  validateAll: () => boolean;
  setErrorsFromBackend: (errorResponse: any) => void;
  resetForm: () => void;
}
```
