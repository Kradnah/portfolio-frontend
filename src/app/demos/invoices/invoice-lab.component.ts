import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ApiSession } from '../../api-session';
import { I18n } from '../../i18n';
import { Check, Extraction, FieldKey, Status, fieldStatus, money, runChecks } from './checks';
import { PageScan, Word, locate, personalData, readImage, readPdf } from './extract';

/** Facturas de ejemplo con la extracción precalculada (public/demo-data/facturas/samples.json). */
interface Sample {
  id: string;
  file: string;
  title: { es: string; en: string };
  extraction: Extraction;
}

type Phase = 'idle' | 'read' | 'ocr' | 'extract' | 'done' | 'error';

interface Box extends Word {
  key: string;
  status: Status;
  label: string;
}

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PAGES = 2;
const FIELD_ORDER: FieldKey[] = [
  'issuerName', 'issuerNit', 'invoiceNumber', 'issueDate', 'dueDate', 'customerName', 'customerId',
  'subtotal', 'taxRate', 'tax', 'total', 'cufe',
];
const MONEY: FieldKey[] = ['subtotal', 'tax', 'total'];

@Component({
  selector: 'app-invoice-lab',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './invoice-lab.component.html',
  styleUrls: ['../demo-shell.css', './invoice-lab.component.css'],
})
export class InvoiceLabComponent implements OnInit {
  protected readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;
  private readonly api = inject(ApiSession);
  private readonly title = inject(Title);

  protected readonly tab = signal<'samples' | 'upload'>('samples');
  protected readonly phase = signal<Phase>('idle');
  protected readonly ocrProgress = signal(0);
  protected readonly error = signal<string | null>(null);
  protected readonly quota = signal({ remainingToday: 5, perDay: 5 });
  protected readonly samples = signal<Sample[]>([]);
  protected readonly pages = signal<PageScan[]>([]);
  protected readonly extraction = signal<Extraction | null>(null);
  protected readonly privacy = signal(false);
  protected readonly hover = signal<string | null>(null);
  protected readonly dragging = signal(false);

  protected readonly fieldOrder = FIELD_ORDER;
  protected readonly maxPages = MAX_PAGES;
  protected readonly busy = computed(() => ['read', 'ocr', 'extract'].includes(this.phase()));
  protected readonly checks = computed<Check[]>(() => {
    const ex = this.extraction();
    return ex?.isInvoice ? runChecks(ex) : [];
  });
  protected readonly status = computed(() => fieldStatus(this.checks()));
  protected readonly failures = computed(() => this.checks().filter((c) => c.status === 'fail').length);
  protected readonly verdict = computed(() => {
    if (!this.extraction()?.isInvoice) return 'none';
    if (this.failures()) return 'fail';
    return this.checks().some((c) => c.status === 'warn') ? 'warn' : 'ok';
  });
  /** Líneas con error (índices) para resaltarlas en la tabla. */
  protected readonly badLines = computed(() => new Set(this.checks().flatMap((c) => (c.status === 'fail' ? (c.lines ?? []) : []))));

  /** Recuadros sobre la primera página: cada campo extraído y cada ítem, coloreado por su estado. */
  protected readonly boxes = computed<Box[]>(() => {
    const ex = this.extraction();
    const page = this.pages()[0];
    if (!ex || !page) return [];
    const st = this.status();
    const labels = this.t().invoices.fields;
    const out: Box[] = [];
    for (const key of FIELD_ORDER) {
      const f = ex.fields[key];
      const box = f.value !== null && f.raw ? locate(page.words, f.raw) : null;
      if (box) out.push({ ...box, key, status: st[key] ?? 'ok', label: labels[key] });
    }
    const bad = this.badLines();
    ex.lines.forEach((l, i) => {
      const box = l.raw ? locate(page.words, l.raw) : null;
      if (box) out.push({ ...box, key: `line-${i}`, status: bad.has(i) ? 'fail' : 'ok', label: l.description });
    });
    return out;
  });

  protected readonly masks = computed(() => {
    const ex = this.extraction();
    const page = this.pages()[0];
    if (!ex || !page) return [];
    return personalData(page.words, [ex.fields.customerId.raw]);
  });

  async ngOnInit(): Promise<void> {
    this.title.setTitle(`${this.t().invoices.title} · Julian Lizcano`);
    window.scrollTo(0, 0);
    try {
      const res = await fetch('/api/demos/invoice/quota');
      if (res.ok) this.quota.set(await res.json());
    } catch {
      // Sin API se muestran los límites por defecto.
    }
    try {
      const res = await fetch('/demo-data/facturas/samples.json', { cache: 'no-cache' });
      if (res.ok && res.headers.get('content-type')?.includes('json')) this.samples.set(await res.json());
    } catch {
      // Sin ejemplos publicados.
    }
    if (!this.samples().length) this.tab.set('upload');
  }

  protected fill(text: string, vars: Record<string, string | number> = {}): string {
    const all: Record<string, string | number> = { pages: MAX_PAGES, n: this.quota().perDay, ...vars };
    return text.replace(/\{(\w+)\}/g, (_, k: string) => String(all[k] ?? ''));
  }

  protected checkText(c: Check): string {
    const texts = this.t().invoices.checks[c.id];
    const key = c.id === 'dates' && c.status === 'fail' ? `fail_${c.vars['reason']}` : c.status;
    return this.fill(texts[key] ?? '', c.vars);
  }

  protected display(key: FieldKey): string {
    const ex = this.extraction();
    const v = ex?.fields[key].value;
    if (v === null || v === undefined) return '';
    if (MONEY.includes(key) && typeof v === 'number') return money(v, ex?.currency);
    if (key === 'taxRate') return `${v} %`;
    return String(v);
  }

  protected money(n: number): string {
    return money(n, this.extraction()?.currency);
  }

  /** Posición del recuadro en % de la página, para que escale con la imagen. */
  protected pos(b: Word): Record<string, string> {
    const p = this.pages()[0];
    const pad = 3;
    return {
      left: `${((b.x - pad) / p.width) * 100}%`,
      top: `${((b.y - pad) / p.height) * 100}%`,
      width: `${((b.w + pad * 2) / p.width) * 100}%`,
      height: `${((b.h + pad * 2) / p.height) * 100}%`,
    };
  }

  // ── Entradas ──────────────────────────────────────────────

  protected async openSample(s: Sample): Promise<void> {
    this.reset();
    try {
      const blob = await (await fetch(`/demo-data/facturas/${s.file}`)).blob();
      const pages = await this.read(blob, 'application/pdf');
      this.pages.set(pages);
      this.extraction.set(s.extraction);
      this.phase.set('done');
    } catch {
      this.fail(this.t().invoices.unreadable);
    }
  }

  protected onFileInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.handle(file);
  }

  protected onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragging.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && !this.busy()) void this.handle(file);
  }

  private async read(file: Blob, type: string): Promise<PageScan[]> {
    const progress = (stage: 'read' | 'ocr', ratio?: number) => {
      this.phase.set(stage);
      if (ratio !== undefined) this.ocrProgress.set(Math.round(ratio * 100));
    };
    const isPdf = type === 'application/pdf' || (file instanceof File && file.name.toLowerCase().endsWith('.pdf'));
    return isPdf ? readPdf(file, MAX_PAGES, progress) : readImage(file, progress);
  }

  private async handle(file: File): Promise<void> {
    const t = this.t().invoices;
    this.reset();
    if (this.quota().remainingToday <= 0) return this.fail(t.noneLeft);
    if (file.size > MAX_BYTES) return this.fail(t.tooBig);

    let pages: PageScan[];
    try {
      pages = await this.read(file, file.type);
    } catch {
      return this.fail(t.unreadable);
    }
    const text = pages.map((p) => p.text).join('\n\n').trim();
    if (text.length < 20) return this.fail(t.noText);
    this.pages.set(pages);

    this.phase.set('extract');
    try {
      const res = await this.api.fetch('/api/demos/invoice', {
        method: 'POST',
        body: JSON.stringify({ text: text.slice(0, 8000), lang: this.i18n.lang() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return this.fail(t.errors[body?.detail] ?? t.errors['default']);
      this.extraction.set(body.extraction as Extraction);
      this.quota.update((q) => ({ ...q, remainingToday: body.remainingToday }));
      this.phase.set('done');
    } catch {
      this.fail(t.errors['default']);
    }
  }

  private fail(message: string): void {
    this.error.set(message);
    this.phase.set('error');
  }

  protected reset(): void {
    this.error.set(null);
    this.pages.set([]);
    this.extraction.set(null);
    this.privacy.set(false);
    this.hover.set(null);
    this.ocrProgress.set(0);
    this.phase.set('idle');
  }

  /** Descarga la primera página con los datos personales tapados (todo ocurre en el navegador). */
  protected async downloadMasked(): Promise<void> {
    const page = this.pages()[0];
    if (!page) return;
    const img = new Image();
    img.src = page.image;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = page.width;
    canvas.height = page.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    ctx.fillStyle = '#000';
    for (const m of this.masks()) ctx.fillRect(m.x - 3, m.y - 3, m.w + 6, m.h + 6);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'factura-enmascarada.png';
    a.click();
  }
}
