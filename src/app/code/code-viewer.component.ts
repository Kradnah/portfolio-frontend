import { Component, ElementRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeHtml, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { I18n } from '../i18n';
import { highlight } from './highlighter';

/** Lo genera `scripts/export-code.mjs`. */
interface Manifest {
  slug: string;
  name: string;
  exportedAt: string;
  sources: { prefix: string; commit: string; date: string }[];
  totalLines: number;
  langs: { lang: string; lines: number }[];
  highlights: { path: string; note: { es: string; en: string } }[];
  files: { p: string; l: number; lang: string }[];
}

interface TreeNode {
  name: string;
  path: string;
  dir: boolean;
  children: TreeNode[];
}

interface Row {
  name: string;
  path: string;
  dir: boolean;
  depth: number;
  open: boolean;
}

const LANG_COLORS: Record<string, string> = {
  typescript: '#c9a2ff', tsx: '#8be000', python: '#ffd23f', javascript: '#f2a65a', html: '#ff7a00',
  css: '#5ec8ff', scss: '#ff5c7a', json: '#b8a8d4', sql: '#e0233c', prisma: '#6b3fa0', markdown: '#ece6f5',
};

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', dir: true, children: [] };
  for (const p of paths) {
    let node = root;
    const parts = p.split('/');
    parts.forEach((name, i) => {
      const path = parts.slice(0, i + 1).join('/');
      const dir = i < parts.length - 1;
      let child = node.children.find((c) => c.name === name && c.dir === dir);
      if (!child) node.children.push((child = { name, path, dir, children: [] }));
      node = child;
    });
  }
  const sort = (n: TreeNode) => {
    n.children.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name));
    n.children.forEach(sort);
  };
  sort(root);
  return root.children;
}

/** "10-20" → [10, 20]; "7" → [7, 7]. */
function parseRange(raw: string | null): [number, number] | null {
  const m = raw?.match(/^(\d+)(?:-(\d+))?$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2] ?? m[1]);
  return [Math.min(a, b), Math.max(a, b)];
}

const ancestors = (path: string) => path.split('/').slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join('/'));
const fileUrl = (slug: string, path: string) => `/code/${slug}/f/${path.split('/').map(encodeURIComponent).join('/')}.txt`;

@Component({
  selector: 'app-code-viewer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './code-viewer.component.html',
  styleUrl: './code-viewer.component.css',
})
export class CodeViewerComponent {
  protected readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly title = inject(Title);
  private readonly host = inject(ElementRef<HTMLElement>);

  private readonly slug = toSignal(this.route.paramMap.pipe(map((p) => p.get('slug') ?? '')), { initialValue: '' });
  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  protected readonly file = computed(() => this.query().get('f'));
  protected readonly range = computed(() => parseRange(this.query().get('l')));

  protected readonly manifest = signal<Manifest | null>(null);
  protected readonly status = signal<'loading' | 'ready' | 'missing'>('loading');
  protected readonly code = signal<SafeHtml | null>(null);
  protected readonly fileStatus = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  protected readonly search = signal('');
  protected readonly copied = signal(false);
  private readonly expanded = signal(new Set<string>());

  private readonly tree = computed(() => buildTree(this.manifest()?.files.map((f) => f.p) ?? []));
  private readonly byPath = computed(() => new Map(this.manifest()?.files.map((f) => [f.p, f]) ?? []));

  protected readonly rows = computed<Row[]>(() => {
    const open = this.expanded();
    const out: Row[] = [];
    const walk = (nodes: TreeNode[], depth: number) => {
      for (const n of nodes) {
        const isOpen = n.dir && open.has(n.path);
        out.push({ name: n.name, path: n.path, dir: n.dir, depth, open: isOpen });
        if (isOpen) walk(n.children, depth + 1);
      }
    };
    walk(this.tree(), 0);
    return out;
  });

  protected readonly results = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return null;
    return (this.manifest()?.files ?? []).filter((f) => f.p.toLowerCase().includes(q)).slice(0, 60);
  });

  protected readonly langBar = computed(() => {
    const m = this.manifest();
    if (!m) return [];
    const top = m.langs.slice(0, 5);
    const rest = m.totalLines - top.reduce((n, l) => n + l.lines, 0);
    const items = top.map((l) => ({ lang: l.lang, pct: (l.lines / m.totalLines) * 100, color: LANG_COLORS[l.lang] ?? '#8a78a8' }));
    if (rest > 0) items.push({ lang: 'other', pct: (rest / m.totalLines) * 100, color: '#4a3866' });
    return items;
  });

  protected readonly currentLines = computed(() => {
    const f = this.file();
    return f ? (this.byPath().get(f)?.l ?? 0) : 0;
  });

  private request = 0;

  constructor() {
    effect(() => {
      const slug = this.slug();
      untracked(() => this.loadManifest(slug));
    });

    effect(() => {
      const m = this.manifest();
      const f = this.file();
      if (!m) return;
      untracked(() => {
        if (f) this.expand(ancestors(f));
        void this.loadFile(m.slug, f);
      });
    });

    // Marca las líneas enlazadas sin volver a resaltar el archivo.
    effect(() => {
      const range = this.range();
      if (this.fileStatus() !== 'ready') return;
      setTimeout(() => this.markRange(range));
    });

    effect(() => {
      const m = this.manifest();
      const f = this.file();
      this.title.setTitle(m ? `${f ? `${f.split('/').pop()} · ` : ''}${m.name} · Julian Lizcano` : 'Julian Lizcano');
    });
  }

  private async loadManifest(slug: string): Promise<void> {
    window.scrollTo(0, 0);
    this.status.set('loading');
    this.manifest.set(null);
    try {
      const res = await fetch(`/code/${encodeURIComponent(slug)}/manifest.json`, { cache: 'no-cache' });
      if (!res.ok || !res.headers.get('content-type')?.includes('json')) throw new Error('missing');
      const m = (await res.json()) as Manifest;
      // Arranca con las carpetas de primer nivel abiertas.
      this.expanded.set(new Set(buildTree(m.files.map((f) => f.p)).filter((n) => n.dir).map((n) => n.path)));
      this.manifest.set(m);
      this.status.set('ready');
    } catch {
      this.status.set('missing');
    }
  }

  private async loadFile(slug: string, path: string | null): Promise<void> {
    const id = ++this.request;
    const entry = path ? this.byPath().get(path) : undefined;
    if (!entry) {
      this.code.set(null);
      this.fileStatus.set(path ? 'error' : 'idle');
      return;
    }
    this.fileStatus.set('loading');
    try {
      const res = await fetch(fileUrl(slug, entry.p));
      // Sin el archivo, el fallback de la SPA devolvería index.html: se trata como error.
      if (!res.ok || res.headers.get('content-type')?.includes('text/html')) throw new Error('missing');
      const html = await highlight(await res.text(), entry.lang);
      if (id !== this.request) return;
      this.code.set(this.sanitizer.bypassSecurityTrustHtml(html)); // Shiki escapa el contenido del archivo.
      this.fileStatus.set('ready');
      const range = untracked(this.range);
      setTimeout(() => {
        if (range) this.scrollToLine(range[0]);
        else this.host.nativeElement.querySelector('.code-scroll')?.scrollTo({ top: 0 });
      });
    } catch {
      if (id === this.request) this.fileStatus.set('error');
    }
  }

  private expand(paths: string[]): void {
    if (paths.every((p) => this.expanded().has(p))) return;
    this.expanded.update((s) => new Set([...s, ...paths]));
  }

  protected toggle(row: Row): void {
    if (!row.dir) {
      this.open(row.path);
      return;
    }
    this.expanded.update((s) => {
      const next = new Set(s);
      if (next.has(row.path)) next.delete(row.path);
      else next.add(row.path);
      return next;
    });
  }

  protected open(path: string): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { f: path } });
    // En móvil el visor queda debajo del árbol: se baja hasta él.
    if (matchMedia('(max-width: 900px)').matches) {
      this.host.nativeElement.querySelector('.viewer')?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  /** Clic en el número de línea: enlaza esa línea; con Shift, el rango desde la anterior. */
  protected onCodeClick(e: MouseEvent): void {
    const line = (e.target as HTMLElement).closest<HTMLElement>('[data-line]');
    if (!line) return;
    const gutter = parseFloat(getComputedStyle(line).paddingLeft) || 56;
    if (e.clientX - line.getBoundingClientRect().left > gutter) return;
    const n = Number(line.dataset['line']);
    const prev = this.range();
    const l = e.shiftKey && prev ? `${Math.min(prev[0], n)}-${Math.max(prev[0], n)}` : String(n);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { l }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  private markRange(range: [number, number] | null): void {
    this.host.nativeElement.querySelectorAll('.code-scroll [data-line]').forEach((el: HTMLElement) => {
      const n = Number(el.dataset['line']);
      el.classList.toggle('hl', !!range && n >= range[0] && n <= range[1]);
    });
  }

  private scrollToLine(n: number): void {
    const el = this.host.nativeElement.querySelector(`.code-scroll [data-line="${n}"]`) as HTMLElement | null;
    const box = this.host.nativeElement.querySelector('.code-scroll') as HTMLElement | null;
    if (el && box) box.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
  }

  protected async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(location.href);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1600);
    } catch {
      // Sin permiso de portapapeles: el enlace sigue en la barra de direcciones.
    }
  }

  protected note(h: Manifest['highlights'][number]): string {
    return h.note[this.i18n.lang()];
  }

  protected crumbs(path: string): string[] {
    return path.split('/');
  }

  protected fmt(n: number): string {
    return n.toLocaleString(this.i18n.lang() === 'es' ? 'es-CO' : 'en-US');
  }
}
