import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useFormValidation } from '../useFormValidation';
import { validateRequired, validateEmail } from '../../utils/validation';

describe('useFormValidation Hook & Component Integration', () => {
  const initialData = {
    email: '',
    nombre: '',
  };

  const rules = {
    email: (val: string) => validateEmail(val),
    nombre: (val: string) => validateRequired(val, 'El nombre', 3),
  };

  it('se inicializa y renderiza campos de formulario correctamente', () => {
    function TestComponent() {
      const { values, errors, touched } = useFormValidation(initialData, rules);
      return (
        <form>
          <input name="email" defaultValue={values.email} />
          {touched.email && errors.email && <span id="error-email">{errors.email}</span>}
          <input name="nombre" defaultValue={values.nombre} />
          {touched.nombre && errors.nombre && <span id="error-nombre">{errors.nombre}</span>}
        </form>
      );
    }

    const html = renderToStaticMarkup(<TestComponent />);
    expect(html).toContain('name="email"');
    expect(html).toContain('name="nombre"');
    expect(html).not.toContain('id="error-email"');
  });

  it('permite inicialización con valores válidos y renderizado limpio', () => {
    function TestValidComponent() {
      const { values } = useFormValidation(
        { email: 'admin@quantix.local', nombre: 'Carlos' },
        rules
      );
      return (
        <div>
          <span id="user-email">{values.email}</span>
          <span id="user-name">{values.nombre}</span>
        </div>
      );
    }

    const html = renderToStaticMarkup(<TestValidComponent />);
    expect(html).toContain('admin@quantix.local');
    expect(html).toContain('Carlos');
  });
});
