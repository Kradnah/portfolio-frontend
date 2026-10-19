import { describe, expect, it } from 'vitest';
import { Extraction, nitDv, runChecks } from './checks';

const field = <T>(value: T | null, raw = '') => ({ value, raw });

function invoice(over: Partial<Extraction['fields']> = {}, lines?: Extraction['lines']): Extraction {
  return {
    isInvoice: true,
    currency: 'COP',
    fields: {
      issuerName: field('Ferretería La Tuerca Ltda.'),
      issuerNit: field('800456789-1'),
      customerName: field('Construcciones Ricaurte S.A.S.'),
      customerId: field('901234567'),
      invoiceNumber: field('FT-77810'),
      issueDate: field('2026-09-20'),
      dueDate: field('2026-10-05'),
      cufe: field('a'.repeat(96)),
      subtotal: field(100000),
      taxRate: field(19),
      tax: field(19000),
      total: field(119000),
      ...over,
    },
    lines: lines ?? [{ description: 'Brocas', quantity: 2, unitPrice: 50000, total: 100000, raw: '' }],
    notes: '',
  };
}

const status = (ex: Extraction, id: string) => runChecks(ex, new Date('2026-10-18')).find((c) => c.id === id)?.status;

describe('nitDv', () => {
  // Mismos valores que calcula scripts/generate-invoices.py para las facturas de ejemplo.
  it('calcula el dígito de verificación de la DIAN', () => {
    expect(nitDv('800456789')).toBe(1);
    expect(nitDv('79888111')).toBe(8);
    expect(nitDv('800.456.789')).toBe(1);
  });
});

describe('runChecks', () => {
  it('una factura correcta pasa todo', () => {
    const checks = runChecks(invoice(), new Date('2026-10-18'));
    expect(checks.filter((c) => c.status !== 'ok')).toEqual([]);
  });

  it('detecta el dígito de verificación equivocado', () => {
    expect(status(invoice({ issuerNit: field('800456789-4') }), 'nit_dv')).toBe('fail');
    expect(status(invoice({ issuerNit: field('800456789') }), 'nit_dv')).toBe('warn');
  });

  it('detecta una línea mal multiplicada y que la suma no da el subtotal', () => {
    const ex = invoice({}, [{ description: 'Taladro', quantity: 1, unitPrice: 89000, total: 98000, raw: '' }]);
    expect(status(ex, 'line_total')).toBe('fail');
    expect(status(ex, 'lines_sum')).toBe('fail');
  });

  it('detecta IVA mal calculado sin marcar el total si subtotal + IVA cuadra', () => {
    const ex = invoice({ tax: field(16000), total: field(116000) });
    expect(status(ex, 'tax')).toBe('fail');
    expect(status(ex, 'total')).toBe('ok');
  });

  it('detecta vencimiento anterior a la emisión y CUFE ausente', () => {
    const ex = invoice({ dueDate: field('2026-09-01'), cufe: field<string>(null) });
    expect(status(ex, 'dates')).toBe('fail');
    expect(status(ex, 'cufe')).toBe('warn');
  });
});
