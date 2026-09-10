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

  it('debe registrar las 5 plantillas de sistema predefinidas con sus agrupaciones', () => {
    expect(PLANTILLAS_SISTEMA).toHaveLength(5);
    
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

    const tplClientes = PLANTILLAS_SISTEMA.find((p) => p.id === 'tpl-clientes');
    expect(tplClientes).toBeDefined();
    expect(tplClientes?.agrupacion).toBe('CLIENTE');
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

  it('debe renderizar el constructor de reportes modular por secciones dinámicas sin tablas', async () => {
    const { default: ReportePersonalizadoBuilder } = await import('../../components/ReportePersonalizadoBuilder');
    const dataset: FilaReporteVenta[] = generarDatasetVentas('ALL', sucursalesMock, 7);

    const html = renderToStaticMarkup(
      <ReportePersonalizadoBuilder
        datosVentas={dataset}
        sucursales={sucursalesMock}
        sucursalSeleccionadaId="ALL"
        nombreSucursalActiva="Matriz Centro"
        nombreOperador="Director General"
        rangoFechaLabel="Últimos 7 días"
      />
    );

    // Verificación del panel izquierdo (lienzo de secciones modulares)
    expect(html).toContain('Lienzo de Secciones');
    expect(html).toContain('+ Agregar Nueva Sección al Reporte');
    expect(html).toContain('Estructura &amp; Jerarquía');

    // Paletas de color corporativas
    expect(html).toContain('Quantix Esmeralda');
    expect(html).toContain('Corporate Cobalt');
    expect(html).toContain('Sunset Ámbar');
    expect(html).toContain('Editorial Slate');

    // Botones de acción
    expect(html).toContain('Exportar Excel');
    expect(html).toContain('Exportar CSV');
    expect(html).toContain('Imprimir / PDF');

    // Verificación del panel derecho (vista previa dinámica con membrete y secciones)
    expect(html).toContain('Vista Previa Modular en Tiempo Real');
    expect(html).toContain('QUANTIX RETAIL OS');
    expect(html).toContain('DuckDB Gold OLAP');
    expect(html).toContain('Ventas Netas');
    expect(html).toContain('Margen de Utilidad');
    expect(html).toContain('Ticket Promedio');
    expect(html).toContain('Top Artículos de Mayor Rotación');

    // Regla crucial: CERO TABLAS en el reporte personalizado
    expect(html).not.toContain('<table');
  });

  it('debe soportar la sección de Inteligencia de Clientes y métricas de cartera sin tablas', async () => {
    const { default: ReportePreview } = await import('../../components/ReportePreview');
    const dataset: FilaReporteVenta[] = generarDatasetVentas('ALL', sucursalesMock, 7);

    const html = renderToStaticMarkup(
      <ReportePreview
        ventas={dataset}
        secciones={[
          {
            id: 'sec-cli-1',
            tipo: 'INTELIGENCIA_CLIENTES',
            titulo: 'Inteligencia & Cartera de Clientes',
            subtitulo: 'Análisis de retención y compradores clave',
          },
          {
            id: 'sec-cli-2',
            tipo: 'DISTRIBUCION_RANKING',
            titulo: 'Top Clientes por Facturación',
            dimensionRanking: 'CLIENTE',
            limiteItems: 5,
          }
        ]}
        paleta="QUANTIX"
        tituloReporte="Reporte de Clientes"
        subtituloReporte="Auditoría de Compradores"
        mostrarLogo={true}
        nombreSucursal="Matriz Centro"
        nombreOperador="Director General"
        rangoFechaLabel="Últimos 7 días"
      />
    );

    expect(html).toContain('Inteligencia &amp; Cartera de Clientes');
    expect(html).toContain('Clientes Únicos');
    expect(html).toContain('Gasto Promedio (LTV)');
    expect(html).toContain('Frecuencia Media');
    expect(html).toContain('Top Clientes por Facturación');
    expect(html).not.toContain('<table');
  });

  it('el Layout principal debe excluir el sidebar y navbar superior en vista de impresión (print:hidden)', async () => {
    const { default: Layout } = await import('../../components/Layout');
    const { MemoryRouter } = await import('react-router-dom');

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );

    // Debe contener print:hidden en aside y header
    expect(html).toMatch(/<aside[^>]*print:hidden/);
    expect(html).toMatch(/<header[^>]*print:hidden/);
  });

  it('generarDatasetVentas filtra estrictamente los datos cuando se selecciona una sucursal específica', () => {
    const datasetMatriz = generarDatasetVentas('suc-01', sucursalesMock, 7);
    const datasetNorte = generarDatasetVentas('suc-02', sucursalesMock, 7);
    const datasetConsolidado = generarDatasetVentas('ALL', sucursalesMock, 7);

    // Matriz solo contiene registros de Matriz Centro
    expect(datasetMatriz.length).toBeGreaterThan(0);
    expect(datasetMatriz.every((v) => v.sucursal_id === 'suc-01')).toBe(true);

    // Norte solo contiene registros de Sucursal Norte
    expect(datasetNorte.length).toBeGreaterThan(0);
    expect(datasetNorte.every((v) => v.sucursal_id === 'suc-02')).toBe(true);

    // Los datasets entre sucursales tienen métricas diferenciadas
    expect(datasetMatriz.length).not.toEqual(datasetNorte.length);

    // El consolidado contiene registros de todas las sedes
    expect(datasetConsolidado.length).toBeGreaterThan(datasetMatriz.length);
    const sucursalesEnConsolidado = new Set(datasetConsolidado.map((v) => v.sucursal_id));
    expect(sucursalesEnConsolidado.has('suc-01')).toBe(true);
    expect(sucursalesEnConsolidado.has('suc-02')).toBe(true);
  });

  it('el constructor de reportes muestra el badge de la sucursal activa en la cabecera del lienzo', async () => {
    const { default: ReportePersonalizadoBuilder } = await import('../../components/ReportePersonalizadoBuilder');
    const datasetNorte = generarDatasetVentas('suc-02', sucursalesMock, 7);

    const html = renderToStaticMarkup(
      <ReportePersonalizadoBuilder
        datosVentas={datasetNorte}
        sucursales={sucursalesMock}
        sucursalSeleccionadaId="suc-02"
        nombreSucursalActiva="Sucursal Norte"
        nombreOperador="Director General"
        rangoFechaLabel="Últimos 7 días"
      />
    );

    // Verifica que el badge de la sucursal activa se muestre en el header del builder y en el preview
    expect(html).toContain('Sucursal Norte');
    expect(html).toContain(`${datasetNorte.length} transacciones`);
  });
});


