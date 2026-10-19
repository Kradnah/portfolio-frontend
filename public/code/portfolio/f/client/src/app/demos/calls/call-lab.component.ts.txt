import { Component, ElementRef, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ApiSession } from '../../api-session';
import { I18n } from '../../i18n';
import { MicRecorder, decodeToMono16k, probeDuration } from './audio';
import type { WorkerIn, WorkerOut } from './whisper.types';

export interface Segment {
  start: number;
  end: number;
  text: string;
}

export interface Analysis {
  isServiceCall: boolean;
  callType: string;
  summary: string;
  customerSentiment: string;
  overall: number | null;
  roles: string[];
  criteria: { key: string; score: number; comment: string; evidence: { segment: number; quote: string }[] }[];
  alerts: { severity: 'high' | 'medium'; text: string; segment: number }[];
  feedback: string[];
}

/** Llamadas de ejemplo con transcripción y análisis precalculados (public/demos/llamadas/samples.json). */
interface Sample {
  id: string;
  title: { es: string; en: string };
  company: string;
  audio: string;
  segments: Segment[];
  analysis: { es: Analysis; en: Analysis };
}

type Phase = 'idle' | 'decode' | 'download' | 'transcribe' | 'analyze' | 'done' | 'error';
type Tab = 'samples' | 'upload' | 'record';

const MAX_BYTES = 15 * 1024 * 1024;

@Component({
  selector: 'app-call-lab',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './call-lab.component.html',
  styleUrl: './call-lab.component.css',
})
export class CallLabComponent implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;
  private readonly api = inject(ApiSession);
  private readonly title = inject(Title);
  private readonly player = viewChild<ElementRef<HTMLAudioElement>>('player');

  protected readonly tab = signal<Tab>('upload');
  protected readonly phase = signal<Phase>('idle');
  protected readonly error = signal<string | null>(null);
  protected readonly download = signal({ loaded: 0, total: 0 });
  protected readonly quota = signal({ remainingToday: 3, perDay: 3, maxSeconds: 180 });
  protected readonly samples = signal<Sample[]>([]);
  protected readonly audioLang = signal<'spanish' | 'english'>(this.i18n.lang() === 'en' ? 'english' : 'spanish');
  protected readonly audioUrl = signal<string | null>(null);
  protected readonly segments = signal<Segment[]>([]);
  protected readonly analysis = signal<Analysis | null>(null);
  protected readonly sample = signal<Sample | null>(null);
  protected readonly active = signal(-1);
  protected readonly focused = signal(-1);
  protected readonly recording = signal(false);
  protected readonly recSeconds = signal(0);
  protected readonly dragging = signal(false);

  /** Con una llamada de ejemplo, el análisis sigue el idioma de la página. */
  protected readonly result = computed(() => {
    const s = this.sample();
    return s ? s.analysis[this.i18n.lang()] : this.analysis();
  });
  protected readonly busy = computed(() => ['decode', 'download', 'transcribe', 'analyze'].includes(this.phase()));
  protected readonly downloadPct = computed(() => {
    const d = this.download();
    return d.total ? Math.min(100, Math.round((d.loaded / d.total) * 100)) : 0;
  });
  protected readonly scoreTone = computed(() => {
    const o = this.result()?.overall;
    return o == null ? 'none' : o >= 75 ? 'good' : o >= 45 ? 'mid' : 'bad';
  });

  private worker?: Worker;
  private recorder = new MicRecorder();
  private recTimer?: ReturnType<typeof setInterval>;

  async ngOnInit(): Promise<void> {
    this.title.setTitle(`${this.t().calls.title} · Julian Lizcano`);
    window.scrollTo(0, 0);
    try {
      const res = await fetch('/api/demos/call-qa/quota');
      if (res.ok) this.quota.set(await res.json());
    } catch {
      // Sin API (p. ej. en local) se muestran los límites por defecto.
    }
    try {
      const res = await fetch('/demos/llamadas/samples.json', { cache: 'no-cache' });
      if (res.ok && res.headers.get('content-type')?.includes('json')) {
        const list = (await res.json()) as Sample[];
        this.samples.set(list);
        if (list.length) this.tab.set('samples');
      }
    } catch {
      // Aún no hay ejemplos publicados.
    }
  }

  ngOnDestroy(): void {
    this.worker?.terminate();
    this.recorder.cancel();
    clearInterval(this.recTimer);
    this.revokeAudio();
  }

  /** Reemplaza {sec}, {n}… en los textos. */
  protected fill(text: string, vars: Record<string, string | number> = {}): string {
    const all = { sec: this.quota().maxSeconds, n: this.quota().perDay, ...vars };
    return text.replace(/\{(\w+)\}/g, (_, k: string) => String(all[k as keyof typeof all] ?? ''));
  }

  protected clock(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  // ── Entradas ──────────────────────────────────────────────

  protected openSample(s: Sample): void {
    this.reset();
    this.sample.set(s);
    this.audioUrl.set(s.audio);
    this.segments.set(s.segments);
    this.phase.set('done');
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

  protected async toggleRecording(): Promise<void> {
    if (this.recording()) {
      this.recorder.stop();
      return;
    }
    this.error.set(null);
    try {
      await this.recorder.start(this.quota().maxSeconds, (blob) => {
        this.recording.set(false);
        clearInterval(this.recTimer);
        void this.handle(blob);
      });
      this.recording.set(true);
      this.recSeconds.set(0);
      this.recTimer = setInterval(() => this.recSeconds.update((n) => n + 1), 1000);
    } catch {
      this.error.set(this.t().calls.micDenied);
    }
  }

  // ── Proceso: decodificar → transcribir (navegador) → analizar (API) ──

  private async handle(blob: Blob): Promise<void> {
    const t = this.t().calls;
    this.reset();
    if (this.quota().remainingToday <= 0) return this.fail(t.noneLeft);
    if (blob.size > MAX_BYTES) return this.fail(t.tooBig);

    const max = this.quota().maxSeconds;
    try {
      const d = await probeDuration(blob);
      if (Number.isFinite(d) && d > max + 1) return this.fail(this.fill(t.tooLong, { d: Math.round(d) }));
    } catch {
      // Algunos formatos (webm de MediaRecorder) no traen duración en los metadatos: se mide al decodificar.
    }

    this.phase.set('decode');
    let audio: Float32Array;
    try {
      const decoded = await decodeToMono16k(blob);
      if (decoded.duration > max + 1) return this.fail(this.fill(t.tooLong, { d: Math.round(decoded.duration) }));
      audio = decoded.audio;
    } catch {
      return this.fail(t.unreadable);
    }
    this.audioUrl.set(URL.createObjectURL(blob));

    let segments: Segment[];
    try {
      segments = await this.transcribe(audio);
    } catch {
      return this.fail(t.errors['transcribe']);
    }
    if (!segments.length) return this.fail(t.errors['empty']);
    this.segments.set(segments);

    this.phase.set('analyze');
    try {
      const res = await this.api.fetch('/api/demos/call-qa', {
        method: 'POST',
        body: JSON.stringify({ segments, lang: this.i18n.lang() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return this.fail(t.errors[body?.detail] ?? t.errors['default'], true);
      this.analysis.set(body.analysis as Analysis);
      this.quota.update((q) => ({ ...q, remainingToday: body.remainingToday }));
      this.phase.set('done');
    } catch {
      this.fail(t.errors['default'], true);
    }
  }

  private transcribe(audio: Float32Array): Promise<Segment[]> {
    this.worker ??= new Worker(new URL('./whisper.worker', import.meta.url), { type: 'module' });
    const worker = this.worker;
    this.phase.set('download');
    return new Promise((resolve, reject) => {
      worker.onmessage = ({ data }: MessageEvent<WorkerOut>) => {
        if (data.type === 'download') this.download.set({ loaded: data.loaded, total: data.total });
        else if (data.type === 'transcribing') this.phase.set('transcribe');
        else if (data.type === 'done') resolve(data.chunks);
        else if (data.type === 'error') reject(new Error(data.message));
      };
      worker.onerror = (e) => reject(new Error(e.message));
      const msg: WorkerIn = { type: 'transcribe', audio, language: this.audioLang() };
      worker.postMessage(msg, [audio.buffer]);
    });
  }

  /** Si falló el análisis pero hay transcripción, se deja visible. */
  private fail(message: string, keepTranscript = false): void {
    this.error.set(message);
    this.phase.set(keepTranscript && this.segments().length ? 'done' : 'error');
  }

  protected reset(): void {
    this.revokeAudio();
    this.error.set(null);
    this.sample.set(null);
    this.analysis.set(null);
    this.segments.set([]);
    this.active.set(-1);
    this.focused.set(-1);
    this.phase.set('idle');
  }

  private revokeAudio(): void {
    const url = this.audioUrl();
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    this.audioUrl.set(null);
  }

  // ── Resultado ─────────────────────────────────────────────

  protected seek(i: number): void {
    const seg = this.segments()[i];
    const el = this.player()?.nativeElement;
    this.focused.set(i);
    document.getElementById(`seg-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (seg && el) {
      el.currentTime = seg.start;
      void el.play().catch(() => undefined);
    }
  }

  protected onTimeUpdate(): void {
    const time = this.player()?.nativeElement.currentTime ?? 0;
    this.active.set(this.segments().findIndex((s) => time >= s.start && time < s.end + 0.05));
  }

  protected role(i: number): string {
    return this.result()?.roles[i] ?? 'unknown';
  }

  protected dots(score: number): boolean[] {
    return [0, 1, 2, 3, 4].map((i) => i < score);
  }
}
