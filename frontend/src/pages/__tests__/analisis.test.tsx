import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Analisis, { 
  COLUMNAS_PREDETERMINADAS, 
  PLANTILLAS_SISTEMA, 
  generarDatasetVentas, 
  type FilaReporteVenta 
} from '../Analisis';
import { type Sucursal } from '../../store/sucursalStore';

// Mocks para Recharts ResponsiveContainer en entorno Node de Vitest
vi.mock('recharts', async () => {
  const original = await vi.importActual('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div className="recharts-responsive-container-mock">{children}</div>
    ),
  };
});

describe('Módulo de Análisis Estadístico & Reportes Avanzados (Analisis.tsx)', () => {
  const sucursalesMock: Sucursal[] = [
    { id: 'suc-01', codigo: 'SUC-01', nombre: 'Matriz Centro', direccion: 'Av. Juárez 100', telefono: '555-0101', es_matriz: true, activo: true },
    { id: 'suc-02', codigo: 'SUC-02', nombre: 'Sucursal Norte', direccion: 'Plaza Norte L-4', telefono: '555-0202', es_matriz: false, activo: true },
  ];

  const directorUser = {
    id: 'usr-dir-01',
    email: 'director@quantix.com',
    nombre: 'Director General',
    rol: 'DIRECTOR',
  };

  const supervisorUser = {
    id: 'usr-sup-02',
    email: 'supervisor@quantix.com',
    nombre: 'Supervisor de Turno',
    rol: 'SUPERVISOR',
  };

  it('debe contener las 15 columnas predeterminadas requeridas para el constructor de reportes', () => {
    expect(COLUMNAS_PREDETERMINADAS).toHaveLength(15);
    const ids = COLUMNAS_PREDETERMINADAS.map((c) => c.id);
    
    expect(ids).toContain('fecha');
    expect(ids).toContain('folio_ticket');
    expect(ids).toContain('sucursal_nombre');
    expect(ids).toContain('cajero_nombre');
    expect(ids).toContain('cliente_nombre');
    expect(ids).toContain('categoria_nombre');
    expect(ids).toContain('producto_nombre');
    expect(ids).toContain('cantidad');
    expect(ids).toContain('precio_unitario');
    expect(ids).toContain('subtotal');
    expect(ids).toContain('descuento');
    expect(ids).toContain('impuestos');
    expect(ids).toContain('total');
    expect(ids).toContain('margen_ganancia');
    expect(ids).toContain('metodo_pago');
  });

  it('debe registrar las 4 plantillas de sistema predefinidas con sus agrupaciones', () => {
    expect(PLANTILLAS_SISTEMA).toHaveLength(4);
    
    const tplCategoria = PLANTILLAS_SISTEMA.find((p) => p.id === 'tpl-categoria');
    expect(tplCategoria).toBeDefined();
    expect(tplCategoria?.agrupacion).toBe('CATEGORIA');

    const tplCajero = PLANTILLAS_SISTEMA.find((p) => p.id === 'tpl-cajero');
    expect(tplCajero).toBeDefined();
    expect(tplCajero?.agrupacion).toBe('CAJERO');

    const tplAuditoria = PLANTILLAS_SISTEMA.find((p) => p.id === 'tpl-auditoria');
    expect(tplAuditoria).toBeDefined();
    expect(tplAuditoria?.agrupacion).toBe('LINEA');

    const tplCierre = PLANTILLAS_SISTEMA.find((p) => p.id === 'tpl-cierre-pago');
    expect(tplCierre).toBeDefined();
    expect(tplCierre?.agrupacion).toBe('METODO_PAGO');
  });

  it('generarDatasetVentas produce ventas consistentes con cálculos matemáticos válidos', () => {
    const dataset: FilaReporteVenta[] = generarDatasetVentas('ALL', sucursalesMock, 7);
    expect(dataset.length).toBeGreaterThan(0);

    for (const venta of dataset) {
      expect(venta.cantidad).toBeGreaterThan(0);
      expect(venta.precio_unitario).toBeGreaterThan(0);
      expect(venta.subtotal).toBeGreaterThanOrEqual(0);
      expect(venta.total).toBeGreaterThanOrEqual(venta.subtotal);
      expect(venta.impuestos).toBeGreaterThanOrEqual(0);
      expect(['EFECTIVO', 'TARJETA', 'QR_DEUNA']).toContain(venta.metodo_pago);
      expect(venta.folio_ticket).toMatch(/^TKT-/);
    }
  });

  it('debe renderizar la cabecera Neo-Retail y los tabs de navegación para rol DIRECTOR', () => {
    const html = renderToStaticMarkup(
      <Analisis 
        initialUser={directorUser} 
        initialSucursales={sucursalesMock} 
        initialSucursalActual={sucursalesMock[0]} 
      />
    );

    expect(html).toContain('Análisis Estadístico &amp; Reportes Avanzados');
    expect(html).toContain('Nivel Estratégico • C-Level &amp; Supervisión');
    expect(html).toContain('DuckDB Gold &amp; OLAP');
    expect(html).toContain('Análisis Estadístico Avanzado');
    expect(html).toContain('Constructor de Reportes &amp; Plantillas');
    expect(html).toContain('Todas las Sucursales (Consolidado)');
  });

  it('debe renderizar el candado y la sucursal fija bloqueada para rol SUPERVISOR (RBAC)', () => {
    const html = renderToStaticMarkup(
      <Analisis 
        initialUser={supervisorUser} 
        initialSucursales={sucursalesMock} 
        initialSucursalActual={sucursalesMock[0]} 
      />
    );

    // Debe mostrar la sucursal fija con badge "Fija"
    expect(html).toContain('Fija');
    expect(html).toContain('Matriz Centro');
    // No debe renderizar el select libre de "Todas las Sucursales" para el supervisor
    expect(html).not.toContain('Todas las Sucursales (Consolidado)');
  });

  it('debe renderizar los 6 KPIs comparativos y las matrices analíticas en el Tab Estadístico', () => {
    const html = renderToStaticMarkup(
      <Analisis 
        initialUser={directorUser} 
        initialSucursales={sucursalesMock} 
        initialSucursalActual={sucursalesMock[0]} 
      />
    );

    expect(html).toContain('Ingresos Netos');
    expect(html).toContain('Margen Bruto %');
    expect(html).toContain('Ticket Promedio');
    expect(html).toContain('Transacciones');
    expect(html).toContain('Clientes Activos');
    expect(html).toContain('Unidades Vendidas');
    expect(html).toContain('Matriz Pareto ABC de Productos');
    expect(html).toContain('Segmentación RFM de Clientes');
    expect(html).toContain('Heatmap de Estacionalidad &amp; Flujo de Caja');
    expect(html).toContain('Proyecciones de Demanda Inferencial (IC 95%)');
  });
});
