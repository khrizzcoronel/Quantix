import { useState, useCallback } from 'react';

export type ValidatorFn<T> = (value: any, allValues: T) => string | null;

export type ValidationRules<T> = {
  [K in keyof T]?: ValidatorFn<T> | Array<ValidatorFn<T>>;
};

export interface UseFormValidationReturn<T> {
  values: T;
  errors: Partial<Record<keyof T, string | null>>;
  touched: Partial<Record<keyof T, boolean>>;
  setValues: React.Dispatch<React.SetStateAction<T>>;
  setValue: <K extends keyof T>(field: K, value: T[K]) => void;
  handleChange: <K extends keyof T>(field: K, value: T[K]) => void;
  handleBlur: <K extends keyof T>(field: K) => void;
  validateField: <K extends keyof T>(field: K) => string | null;
  validateAll: () => boolean;
  setFieldError: <K extends keyof T>(field: K, error: string | null) => void;
  setServerErrors: (error: unknown, fallbackGeneralSetter?: (msg: string) => void) => void;
  resetForm: (newValues?: T) => void;
}

export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  rules: ValidationRules<T> = {}
): UseFormValidationReturn<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string | null>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  // Valida un campo individual según sus reglas registradas
  const validateField = useCallback(
    <K extends keyof T>(field: K, currentValues: T = values): string | null => {
      const fieldRules = rules[field];
      if (!fieldRules) return null;

      const ruleList = Array.isArray(fieldRules) ? fieldRules : [fieldRules];
      const val = currentValues[field];

      for (const rule of ruleList) {
        const err = rule(val, currentValues);
        if (err) return err;
      }
      return null;
    },
    [rules, values]
  );

  // Modifica un valor y limpia el error previo del campo
  const handleChange = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setValues((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        if (prev[field]) {
          return { ...prev, [field]: null };
        }
        return prev;
      });
    },
    []
  );

  const setValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    handleChange(field, value);
  }, [handleChange]);

  // Al perder el foco (onBlur), valida el campo y lo marca como visitado
  const handleBlur = useCallback(
    <K extends keyof T>(field: K) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const fieldError = validateField(field);
      setErrors((prev) => ({ ...prev, [field]: fieldError }));
    },
    [validateField]
  );

  // Valida todos los campos registrados (para onSubmit)
  const validateAll = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof T, string | null>> = {};
    const newTouched: Partial<Record<keyof T, boolean>> = {};
    let hasError = false;

    for (const key of Object.keys(rules) as Array<keyof T>) {
      newTouched[key] = true;
      const err = validateField(key, values);
      if (err) {
        newErrors[key] = err;
        hasError = true;
      }
    }

    setTouched((prev) => ({ ...prev, ...newTouched }));
    setErrors(newErrors);

    // Auto-enfocar el primer campo con error en el DOM
    if (hasError) {
      const firstErrorKey = Object.keys(newErrors).find((k) => newErrors[k as keyof T]);
      if (firstErrorKey) {
        const el = document.getElementById(firstErrorKey) || document.querySelector(`[name="${firstErrorKey}"]`);
        if (el && 'focus' in el) {
          (el as HTMLElement).focus();
        }
      }
    }

    return !hasError;
  }, [rules, validateField, values]);

  const setFieldError = useCallback(<K extends keyof T>(field: K, error: string | null) => {
    setErrors((prev) => ({ ...prev, [field]: error }));
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  // Extrae y mapea errores 422 de Pydantic FastAPI o strings de error genéricos
  const setServerErrors = useCallback(
    (error: unknown, fallbackGeneralSetter?: (msg: string) => void) => {
      const response = (error as { response?: { data?: { detail?: any } } })?.response;
      const detail = response?.data?.detail;

      if (Array.isArray(detail)) {
        const serverFieldErrors: Partial<Record<keyof T, string | null>> = {};
        const generalMessages: string[] = [];

        detail.forEach((item: any) => {
          if (Array.isArray(item.loc) && item.loc.length > 1) {
            // El nombre del campo suele estar al final de loc: ['body', 'nombre']
            const fieldName = item.loc[item.loc.length - 1] as keyof T;
            const message = item.msg || 'Dato inválido';
            serverFieldErrors[fieldName] = message;
          } else if (item.msg) {
            generalMessages.push(item.msg);
          }
        });

        setErrors((prev) => ({ ...prev, ...serverFieldErrors }));
        setTouched((prev) => {
          const updated = { ...prev };
          (Object.keys(serverFieldErrors) as Array<keyof T>).forEach((k) => {
            updated[k] = true;
          });
          return updated;
        });

        if (generalMessages.length > 0 && fallbackGeneralSetter) {
          fallbackGeneralSetter(generalMessages.join('. '));
        }
      } else if (typeof detail === 'string') {
        if (fallbackGeneralSetter) {
          fallbackGeneralSetter(detail);
        }
      } else if (fallbackGeneralSetter) {
        fallbackGeneralSetter('Ocurrió un error inesperado al procesar la solicitud.');
      }
    },
    []
  );

  const resetForm = useCallback(
    (newValues?: T) => {
      setValues(newValues || initialValues);
      setErrors({});
      setTouched({});
    },
    [initialValues]
  );

  return {
    values,
    errors,
    touched,
    setValues,
    setValue,
    handleChange,
    handleBlur,
    validateField,
    validateAll,
    setFieldError,
    setServerErrors,
    resetForm,
  };
}
