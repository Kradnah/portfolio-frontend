// Validaciones deterministas de la factura. La IA solo extrae los datos; aquí se decide si cuadran.

export interface Field<T> {
  value: T | null;
  raw: string;
}

export interface Extraction {
  isInvoice: boolean;
  currency: string;
  fields: {
    issuerName: Field<string>;
    issuerNit: Field<string>;
    customerName: Field<string>;
    customerId: Field<string>;
    invoiceNumber: Field<string>;
    issueDate: Field<string>;
    dueDate: Field<string>;
    cufe: Field<string>;
    subtotal: Field<number>;
    taxRate: Field<number>;
    tax: Field<number>;
    total: Field<number>;
  };
  lines: { description: string; quantity: number; unitPrice: number; total: number; raw: string }[];
  notes: string;
}

export type FieldKey = keyof Extraction['fields'];
export type Status = 'ok' | 'fail' | 'warn' | 'skip';

export interface Check {
  id: 'required' | 'nit_dv' | 'line_total' | 'lines_sum' | 'tax_rate' | 'tax' | 'total' | 'dates' | 'cufe';
  status: Status;
  /** Valores para rellenar el texto explicativo (i18n). */
  vars: Record<string, string | number>;
  fields: FieldKey[];
  /** Índices de las líneas implicadas (para resaltarlas). */
  lines?: number[];
}

const WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

/** Dígito de verificación del NIT según la DIAN (módulo 11 con pesos primos). */
export function nitDv(nit: string): number {
  const digits = nit.replace(/\D/g, '');
  const sum = [...digits].reverse().reduce((acc, d, i) => acc + Number(d) * WEIGHTS[i], 0);
  const r = sum % 11;
  return r > 1 ? 11 - r : r;
}

/** Iguales con la tolerancia de un redondeo: 1 peso o 0,1 %. */
const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.001);

const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export function money(n: number, currency = 'COP'): string {
  try {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return n.toLocaleString('es-CO');
  }
}

export function runChecks(ex: Extraction, today = new Date()): Check[] {
  const f = ex.fields;
  const cur = ex.currency || 'COP';
  const checks: Check[] = [];

  const required: FieldKey[] = ['invoiceNumber', 'issuerNit', 'issueDate', 'total'];
  const missing = required.filter((k) => f[k].value === null);
  checks.push({ id: 'required', status: missing.length ? 'fail' : 'ok', vars: { missing: missing.length }, fields: missing.length ? missing : required });

  // NIT del emisor: base + dígito de verificación.
  const nit = f.issuerNit.value;
  if (!nit) {
    checks.push({ id: 'nit_dv', status: 'skip', vars: {}, fields: ['issuerNit'] });
  } else {
    const [base, dv] = nit.split('-');
    if (dv === undefined) {
      checks.push({ id: 'nit_dv', status: 'warn', vars: { expected: nitDv(base) }, fields: ['issuerNit'] });
    } else {
      const expected = nitDv(base);
      checks.push({ id: 'nit_dv', status: Number(dv) === expected ? 'ok' : 'fail', vars: { got: dv, expected }, fields: ['issuerNit'] });
    }
  }

  // Cada línea: cantidad × valor unitario = total de la línea.
  if (ex.lines.length) {
    const bad = ex.lines.map((l, i) => (close(l.quantity * l.unitPrice, l.total) ? -1 : i)).filter((i) => i >= 0);
    const first = bad.length ? ex.lines[bad[0]] : null;
    checks.push({
      id: 'line_total',
      status: bad.length ? 'fail' : 'ok',
      vars: first ? { desc: first.description, expected: money(first.quantity * first.unitPrice, cur), got: money(first.total, cur) } : { n: ex.lines.length },
      fields: [],
      lines: bad,
    });
  }

  // Suma de las líneas = subtotal.
  const subtotal = f.subtotal.value;
  if (ex.lines.length && subtotal !== null) {
    const sum = ex.lines.reduce((acc, l) => acc + l.total, 0);
    checks.push({ id: 'lines_sum', status: close(sum, subtotal) ? 'ok' : 'fail', vars: { sum: money(sum, cur), subtotal: money(subtotal, cur) }, fields: ['subtotal'] });
  }

  // Tarifa de IVA válida en Colombia y valor del IVA.
  const rate = f.taxRate.value;
  const tax = f.tax.value;
  if (rate !== null) {
    checks.push({ id: 'tax_rate', status: [0, 5, 19].includes(rate) ? 'ok' : 'warn', vars: { rate }, fields: ['taxRate'] });
  }
  if (rate !== null && tax !== null && subtotal !== null) {
    const expected = Math.round((subtotal * rate) / 100);
    checks.push({ id: 'tax', status: close(expected, tax) ? 'ok' : 'fail', vars: { rate, expected: money(expected, cur), got: money(tax, cur) }, fields: ['tax', 'taxRate'] });
  }

  // Subtotal + IVA = total.
  const total = f.total.value;
  if (subtotal !== null && total !== null) {
    const expected = subtotal + (tax ?? 0);
    checks.push({ id: 'total', status: close(expected, total) ? 'ok' : 'fail', vars: { expected: money(expected, cur), got: money(total, cur) }, fields: ['total'] });
  }

  // Fechas: la emisión no está en el futuro y el vencimiento no es anterior a la emisión.
  const issued = f.issueDate.value;
  const due = f.dueDate.value;
  if (isDate(issued)) {
    const future = Date.parse(issued) > today.getTime() + 86_400_000;
    const before = isDate(due) && Date.parse(due) < Date.parse(issued);
    checks.push({
      id: 'dates',
      status: future || before ? 'fail' : 'ok',
      vars: { issued, due: due ?? '—', reason: future ? 'future' : before ? 'before' : 'ok' },
      fields: before ? ['dueDate', 'issueDate'] : ['issueDate', 'dueDate'],
    });
  }

  // CUFE: código único de factura electrónica (SHA-384 → 96 caracteres hexadecimales).
  const cufe = f.cufe.value;
  checks.push({
    id: 'cufe',
    status: !cufe ? 'warn' : /^[0-9a-f]{96}$/.test(cufe) ? 'ok' : 'fail',
    vars: { len: cufe?.length ?? 0 },
    fields: ['cufe'],
  });

  return checks;
}

/** Estado de cada campo para colorear su recuadro: falla si alguna validación que lo usa falla. */
export function fieldStatus(checks: Check[]): Partial<Record<FieldKey, Status>> {
  const out: Partial<Record<FieldKey, Status>> = {};
  const rank: Record<Status, number> = { skip: 0, ok: 1, warn: 2, fail: 3 };
  for (const c of checks) {
    for (const k of c.fields) {
      const prev = out[k];
      if (!prev || rank[c.status] > rank[prev]) out[k] = c.status;
    }
  }
  return out;
}
