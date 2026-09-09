/**
 * Motor de Validación Centralizado para Quantix Retail OS
 * Funciones de validación puras con retroalimentación clara y en español.
 */

// ============================================================================
// 1. CÉDULA Y RUC ECUATORIANO (ALGORITMO MÓDULO 10)
// ============================================================================

/**
 * Valida una cédula ecuatoriana de 10 dígitos utilizando el algoritmo de Módulo 10.
 * Provincias válidas: 01 a 24, o 30 para residentes especiales.
 * Tercer dígito debe ser menor a 6 para personas naturales.
 */
export function validarCedulaEcuatoriana(cedula: string): boolean {
  const clean = cedula.trim().replace(/\D/g, '');
  if (clean.length !== 10) return false;

  const provincia = parseInt(clean.substring(0, 2), 10);
  if ((provincia < 1 || provincia > 24) && provincia !== 30) return false;

  const tercerDigito = parseInt(clean.charAt(2), 10);
  if (tercerDigito >= 6) return false;

  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;

  for (let i = 0; i < 9; i++) {
    let valor = parseInt(clean.charAt(i), 10) * coeficientes[i];
    if (valor >= 10) valor -= 9;
    suma += valor;
  }

  const digitoVerificadorCalculado = (10 - (suma % 10)) % 10;
  const digitoVerificadorReal = parseInt(clean.charAt(9), 10);

  return digitoVerificadorCalculado === digitoVerificadorReal;
}

/**
 * Valida una identificación (Cédula de 10 dígitos o RUC de 13 dígitos terminado en 001).
 */
export function validateCedulaRuc(identificacion: string): string | null {
  const clean = identificacion.trim().replace(/\D/g, '');
  if (!clean) return 'La identificación (Cédula o RUC) es requerida';

  if (clean.length === 10) {
    if (!validarCedulaEcuatoriana(clean)) {
      return 'Cédula inválida: el dígito verificador o código provincial no coincide';
    }
    return null;
  }

  if (clean.length === 13) {
    const baseCedula = clean.substring(0, 10);
    const sufijo = clean.substring(10, 13);

    if (sufijo === '000') {
      return 'RUC inválido: el establecimiento no puede ser 000 (debe terminar en 001, etc.)';
    }

    // Para personas naturales con RUC, los primeros 10 dígitos deben ser una cédula válida
    const tercerDigito = parseInt(clean.charAt(2), 10);
    if (tercerDigito < 6) {
      if (!validarCedulaEcuatoriana(baseCedula)) {
        return 'RUC de persona natural inválido: los primeros 10 dígitos no forman una cédula válida';
      }
    }
    return null;
  }

  return 'La identificación debe contener exactamente 10 dígitos (Cédula) o 13 dígitos (RUC)';
}

// ============================================================================
// 2. EMAIL (RFC 5322)
// ============================================================================

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function validateEmail(email: string, required: boolean = true): string | null {
  const clean = email.trim();
  if (!clean) {
    return required ? 'El correo electrónico es obligatorio' : null;
  }
  if (!EMAIL_REGEX.test(clean)) {
    return 'Formato de correo electrónico inválido (ejemplo: usuario@dominio.com)';
  }
  if (clean.length > 254) {
    return 'El correo electrónico no puede superar los 254 caracteres';
  }
  return null;
}

// ============================================================================
// 3. TELÉFONO CELULAR / CONVENCIONAL
// ============================================================================

export function validatePhone(phone: string, required: boolean = true): string | null {
  const clean = phone.trim().replace(/[\s-]/g, '');
  if (!clean) {
    return required ? 'El número telefónico es obligatorio' : null;
  }

  // Celular ecuatoriano: 10 dígitos comenzando con 09 (ej. 0991234567)
  // Convencional: 9 dígitos comenzando con 02 a 07 (ej. 022345678)
  const isEcuadorMobile = /^09\d{8}$/.test(clean);
  const isEcuadorLandline = /^0[2-7]\d{7}$/.test(clean);
  const isInternational = /^\+\d{10,14}$/.test(clean);

  if (!isEcuadorMobile && !isEcuadorLandline && !isInternational) {
    return 'Teléfono inválido: debe ser un celular de 10 dígitos (ej. 0991234567) o con código provincial (ej. 022345678)';
  }

  return null;
}

// ============================================================================
// 4. CONTRASEÑAS SEGURAS (POLÍTICA PCI-DSS / OWASP)
// ============================================================================

export interface PasswordStrength {
  score: number; // 0 a 4
  label: 'Muy débil' | 'Débil' | 'Aceptable' | 'Fuerte';
  hasMinLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  let score = 0;
  if (hasMinLength) score++;
  if (hasUpper && hasLower) score++;
  if (hasNumber) score++;
  if (hasSpecial) score++;

  let label: PasswordStrength['label'] = 'Muy débil';
  if (score === 2) label = 'Débil';
  else if (score === 3) label = 'Aceptable';
  else if (score >= 4) label = 'Fuerte';

  return { score, label, hasMinLength, hasUpper, hasLower, hasNumber, hasSpecial };
}

export function validatePassword(password: string): string | null {
  if (!password) return 'La contraseña es obligatoria';
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (!/[A-Z]/.test(password)) return 'Debe contener al menos una letra mayúscula (A-Z)';
  if (!/[a-z]/.test(password)) return 'Debe contener al menos una letra minúscula (a-z)';
  if (!/[0-9]/.test(password)) return 'Debe contener al menos un número (0-9)';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Debe contener al menos un carácter especial (!@#$%^&*...)';
  return null;
}

// ============================================================================
// 5. NÚMEROS, MONTOS Y RANGOS
// ============================================================================

export interface NumberValidationOptions {
  allowZero?: boolean;
  min?: number;
  max?: number;
  decimalsAllowed?: boolean;
}

export function validatePositiveNumber(
  value: string | number,
  label: string = 'El valor',
  options: NumberValidationOptions = {}
): string | null {
  const { allowZero = false, min, max, decimalsAllowed = true } = options;

  if (value === '' || value === null || value === undefined) {
    return `${label} es requerido`;
  }

  const num = typeof value === 'number' ? value : parseFloat(String(value).trim());

  if (isNaN(num)) {
    return `${label} debe ser un número válido`;
  }

  if (!decimalsAllowed && !Number.isInteger(num)) {
    return `${label} debe ser un número entero sin decimales`;
  }

  if (!allowZero && num <= 0) {
    return `${label} debe ser estrictamente mayor a 0`;
  }

  if (allowZero && num < 0) {
    return `${label} no puede ser un número negativo`;
  }

  if (min !== undefined && num < min) {
    return `${label} no puede ser menor a ${min}`;
  }

  if (max !== undefined && num > max) {
    return `${label} no puede superar ${max}`;
  }

  return null;
}

// ============================================================================
// 6. FECHAS (FUTURA / POLÍTICA FEFO)
// ============================================================================

export function validateFutureDate(dateStr: string, label: string = 'La fecha'): string | null {
  if (!dateStr || !dateStr.trim()) {
    return `${label} es obligatoria`;
  }

  const targetDate = new Date(dateStr);
  if (isNaN(targetDate.getTime())) {
    return `${label} no tiene un formato válido (AAAA-MM-DD)`;
  }

  // Comparar con el inicio del día de hoy en hora local
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // La fecha seleccionada en string ISO YYYY-MM-DD parseada como fecha local
  const [year, month, day] = dateStr.split('-').map(Number);
  const parsedTarget = new Date(year, month - 1, day);

  if (parsedTarget <= today) {
    return `${label} debe ser una fecha futura (estrictamente posterior a hoy para política FEFO)`;
  }

  return null;
}

// ============================================================================
// 7. TEXTO REQUERIDO Y LONGITUD
// ============================================================================

export function validateRequired(
  value: string,
  label: string = 'Este campo',
  minLength: number = 1,
  maxLength?: number
): string | null {
  const clean = (value || '').trim();
  if (!clean) {
    return `${label} es obligatorio`;
  }
  if (clean.length < minLength) {
    return `${label} debe tener al menos ${minLength} caracteres`;
  }
  if (maxLength && clean.length > maxLength) {
    return `${label} no puede exceder ${maxLength} caracteres`;
  }
  return null;
}

// ============================================================================
// 8. CÓDIGO DE BARRAS EAN-13
// ============================================================================

export function validateEan13(code: string): string | null {
  const clean = (code || '').trim().replace(/\D/g, '');
  if (!clean) return null; // Es opcional si está vacío

  if (clean.length !== 13) {
    return 'El código de barras EAN-13 debe contener exactamente 13 dígitos numéricos';
  }

  let suma = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(clean.charAt(i), 10);
    suma += i % 2 === 0 ? digit : digit * 3;
  }

  const checkDigitCalculado = (10 - (suma % 10)) % 10;
  const checkDigitReal = parseInt(clean.charAt(12), 10);

  if (checkDigitCalculado !== checkDigitReal) {
    return `Código EAN-13 inválido: el dígito verificador esperado es ${checkDigitCalculado}, pero se ingresó ${checkDigitReal}`;
  }

  return null;
}
