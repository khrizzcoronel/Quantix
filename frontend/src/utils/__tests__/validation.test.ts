import { describe, it, expect } from 'vitest';
import {
  validarCedulaEcuatoriana,
  validateCedulaRuc,
  validateEmail,
  validatePhone,
  validatePassword,
  evaluatePasswordStrength,
  validatePositiveNumber,
  validateFutureDate,
  validateRequired,
  validateEan13
} from '../validation';

describe('Motor de Validación - validation.ts', () => {
  describe('Cédula y RUC Ecuatoriano (Módulo 10)', () => {
    it('valida cédulas ecuatorianas reales con dígito verificador correcto', () => {
      // 1710034065 es una cédula válida de Pichincha
      expect(validarCedulaEcuatoriana('1710034065')).toBe(true);
      expect(validateCedulaRuc('1710034065')).toBeNull();
    });

    it('rechaza cédulas con dígito verificador erróneo o longitud incorrecta', () => {
      expect(validarCedulaEcuatoriana('1710034069')).toBe(false);
      expect(validateCedulaRuc('1710034069')).toContain('Cédula inválida');
      expect(validateCedulaRuc('12345')).toContain('10 dígitos (Cédula) o 13 dígitos (RUC)');
    });

    it('valida RUC de persona natural terminado en 001', () => {
      expect(validateCedulaRuc('1710034065001')).toBeNull();
    });

    it('rechaza RUC con sucursal 000', () => {
      expect(validateCedulaRuc('1710034065000')).toContain('no puede ser 000');
    });
  });

  describe('Correo Electrónico', () => {
    it('acepta correos electrónicos válidos', () => {
      expect(validateEmail('admin@quantix.local')).toBeNull();
      expect(validateEmail('cliente.ejemplo@empresa.com.ec')).toBeNull();
    });

    it('rechaza correos con formato inválido', () => {
      expect(validateEmail('no-es-correo')).toContain('Formato de correo electrónico inválido');
      expect(validateEmail('correo@')).toContain('Formato de correo electrónico inválido');
      expect(validateEmail('@dominio.com')).toContain('Formato de correo electrónico inválido');
      expect(validateEmail('')).toContain('obligatorio');
    });

    it('permite vacío si required=false', () => {
      expect(validateEmail('', false)).toBeNull();
    });
  });

  describe('Teléfono', () => {
    it('acepta números celulares válidos de 10 dígitos (09...)', () => {
      expect(validatePhone('0991234567')).toBeNull();
      expect(validatePhone('098 765 4321')).toBeNull();
      expect(validatePhone('099-112-3344')).toBeNull();
    });

    it('acepta números convencionales con código provincial (02...)', () => {
      expect(validatePhone('022345678')).toBeNull();
    });

    it('rechaza teléfonos con longitud o prefijos erróneos', () => {
      expect(validatePhone('1234567')).toContain('Teléfono inválido');
      expect(validatePhone('0881234567')).toContain('Teléfono inválido');
    });
  });

  describe('Contraseñas', () => {
    it('evalúa la robustez de contraseñas (PCI-DSS)', () => {
      const debil = evaluatePasswordStrength('admin');
      expect(debil.score).toBeLessThanOrEqual(2);
      expect(debil.hasSpecial).toBe(false);

      const fuerte = evaluatePasswordStrength('Admin123!');
      expect(fuerte.score).toBe(4);
      expect(fuerte.label).toBe('Fuerte');
      expect(validatePassword('Admin123!')).toBeNull();
    });

    it('rechaza contraseñas que no cumplen políticas de seguridad', () => {
      expect(validatePassword('corta')).toContain('al menos 8 caracteres');
      expect(validatePassword('todominusculas123!')).toContain('letra mayúscula');
      expect(validatePassword('TODOMAYUSCULAS123!')).toContain('letra minúscula');
      expect(validatePassword('SoloLetrasYSimbolo!')).toContain('al menos un número');
      expect(validatePassword('SoloLetrasY1234')).toContain('carácter especial');
    });
  });

  describe('Números y Rangos', () => {
    it('valida números positivos estrictos', () => {
      expect(validatePositiveNumber(25.50, 'El precio')).toBeNull();
      expect(validatePositiveNumber(0, 'El precio')).toContain('estrictamente mayor a 0');
      expect(validatePositiveNumber(-5, 'El precio')).toContain('estrictamente mayor a 0');
      expect(validatePositiveNumber('no-num', 'El precio')).toContain('debe ser un número válido');
    });

    it('respeta allowZero, min y max', () => {
      expect(validatePositiveNumber(0, 'El descuento', { allowZero: true })).toBeNull();
      expect(validatePositiveNumber(-1, 'El descuento', { allowZero: true })).toContain('no puede ser un número negativo');
      expect(validatePositiveNumber(150, 'El porcentaje', { max: 100 })).toContain('no puede superar 100');
      expect(validatePositiveNumber(5, 'La cantidad', { min: 10 })).toContain('no puede ser menor a 10');
    });
  });

  describe('Fechas Futuras (FEFO)', () => {
    it('acepta fechas posteriores a hoy', () => {
      const futuro = new Date();
      futuro.setFullYear(futuro.getFullYear() + 1);
      const iso = futuro.toISOString().split('T')[0];
      expect(validateFutureDate(iso, 'Vencimiento')).toBeNull();
    });

    it('rechaza fechas pasadas o de hoy', () => {
      expect(validateFutureDate('2020-01-01', 'Vencimiento')).toContain('debe ser una fecha futura');
    });
  });

  describe('Texto Requerido y EAN-13', () => {
    it('valida longitud mínima y texto requerido', () => {
      expect(validateRequired('Nombre válido', 'Nombre', 3)).toBeNull();
      expect(validateRequired('', 'Nombre', 3)).toContain('obligatorio');
      expect(validateRequired('ab', 'Nombre', 3)).toContain('al menos 3 caracteres');
    });

    it('valida códigos de barra EAN-13', () => {
      // 7861000100014 es un EAN-13 con dígito verificador válido (suma ponderada 46 -> 4)
      expect(validateEan13('7861000100014')).toBeNull();
      // Con dígito alterado debe fallar
      expect(validateEan13('7861000100015')).toContain('Código EAN-13 inválido');
    });
  });
});
