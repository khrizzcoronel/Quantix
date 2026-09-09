import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import TicketModal, { type TicketData } from '../TicketModal';

describe('TicketModal Component - Defensiveness against string decimals and null client', () => {
  it('debe renderizar correctamente cuando los números vienen como strings desde la API y el cliente es null', () => {
    const rawApiTicket: TicketData = {
      id: 'f87b8d80-5a33-4f9e-9908-724bbefc4a11',
      folio_ticket: 'TKT-2026-00099',
      fecha_hora: '2026-09-09T14:30:00Z',
      terminal_id: 'TERM-01',
      cajero_nombre: 'Cajero Test',
      cliente_nombre: null,
      cliente_telefono: null,
      cliente_email: null,
      items: [
        {
          nombre: 'Leche Entera Lala 1L',
          sku: 'LAL-ENT-1L',
          cantidad: '2.00' as unknown as number,
          precio_unitario: '26.00' as unknown as number,
          subtotal: '52.00' as unknown as number,
          lote_codigo: 'LOT-2026-01',
        },
      ],
      subtotal: '52.00' as unknown as number,
      descuento: '0.00' as unknown as number,
      impuestos: '8.32' as unknown as number,
      total: '60.32' as unknown as number,
      metodo_pago: 'EFECTIVO',
      monto_recibido: '100.00' as unknown as number,
      cambio: '39.68' as unknown as number,
      estado: 'COMPLETADA',
    };

    // No debe lanzar Uncaught TypeError: .toFixed is not a function
    let html = '';
    expect(() => {
      html = renderToStaticMarkup(
        React.createElement(TicketModal, {
          isOpen: true,
          onClose: () => {},
          ticket: rawApiTicket,
        })
      );
    }).not.toThrow();

    // Verificaciones de contenido formateado
    expect(html).toContain('TKT-2026-00099');
    expect(html).toContain('Leche Entera Lala 1L');
    expect(html).toContain('$52.00'); // Subtotal
    expect(html).toContain('$60.32'); // Total
    expect(html).toContain('EFECTIVO');
    // Como cliente_nombre es null, debe renderizar por defecto CONSUMIDOR FINAL y 9999999999999
    expect(html).toContain('CONSUMIDOR FINAL');
    expect(html).toContain('9999999999999');
  });

  it('no debe renderizar nada si isOpen es false o ticket es null', () => {
    const htmlClosed = renderToStaticMarkup(
      React.createElement(TicketModal, {
        isOpen: false,
        onClose: () => {},
        ticket: null,
      })
    );
    expect(htmlClosed).toBe('');
  });
});
