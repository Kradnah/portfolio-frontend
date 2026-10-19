import { Component, ElementRef, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ApiSession } from '../../api-session';
import { I18n } from '../../i18n';
import { type Detection, Detector, type FrameResult, HAND_LINKS, LABELS_ES } from './detector';

type Phase = 'idle' | 'loading' | 'starting' | 'live' | 'denied' | 'no-camera' | 'failed';

interface Description {
  safe: boolean;
  inHand: string;
  description: string;
  objects: string[];
  funFact: string;
}

const LIME = '#8be000';
const ORANGE = '#ff7a00';
/** Cada cuánto se refresca el panel lateral (el lienzo se dibuja en cada cuadro). */
const PANEL_MS = 250;

@Component({
  selector: 'app-vision-lab',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './vision-lab.component.html',
  styleUrls: ['../demo-shell.css', './vision-lab.component.css'],
})
export class VisionLabComponent implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;
  private readonly api = inject(ApiSession);
  private readonly title = inject(Title);

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('overlay');

  protected readonly phase = signal<Phase>('idle');
  protected readonly facing = signal<'user' | 'environment'>('user');
  protected readonly canFlip = signal(false);
  protected readonly fps = signal(0);
  protected readonly ms = signal(0);
  protected readonly delegate = signal<'GPU' | 'CPU' | null>(null);
  protected readonly scene = signal<Detection[]>([]);
  protected readonly quota = signal({ remainingToday: 5, perDay: 5 });
  protected readonly asking = signal(false);
  protected readonly answer = signal<Description | null>(null);
  protected readonly askError = signal<string | null>(null);

  protected readonly held = computed(() => this.scene().find((d) => d.inHand) ?? null);
  protected readonly others = computed(() => this.scene().filter((d) => !d.inHand && d.label !== 'person'));

  private detector?: Detector;
  private stream?: MediaStream;
  private frame = 0;
  private lastPanel = 0;
  private frames: number[] = [];
  private latest: FrameResult | null = null;

  async ngOnInit(): Promise<void> {
    this.title.setTitle(`${this.t().vision.title} · Julian Lizcano`);
    window.scrollTo(0, 0);
    try {
      const devices = await navigator.mediaDevices?.enumerateDevices();
      this.canFlip.set((devices ?? []).filter((d) => d.kind === 'videoinput').length > 1);
    } catch {
      // Sin enumeración de dispositivos: no se ofrece cambiar de cámara.
    }
    try {
      const res = await fetch('/api/demos/vision/quota');
      if (res.ok) this.quota.set(await res.json());
    } catch {
      // Sin API se muestran los límites por defecto.
    }
  }

  ngOnDestroy(): void {
    this.stop();
    this.detector?.close();
  }

  protected label(name: string): string {
    return this.i18n.lang() === 'es' ? (LABELS_ES[name] ?? name) : name;
  }

  protected pct(score: number): string {
    return `${Math.round(score * 100)} %`;
  }

  protected fill(text: string, vars: Record<string, string | number>): string {
    return text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
  }

  // ── Cámara ────────────────────────────────────────────────

  protected async start(): Promise<void> {
    try {
      if (!this.detector) {
        this.phase.set('loading');
        this.detector = await Detector.load();
        this.delegate.set(this.detector.delegate);
      }
    } catch {
      this.phase.set('failed');
      return;
    }
    this.phase.set('starting');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.facing(), width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch (err) {
      const name = (err as DOMException)?.name;
      this.phase.set(name === 'NotFoundError' || name === 'OverconstrainedError' ? 'no-camera' : 'denied');
      return;
    }
    const video = this.video()!.nativeElement;
    video.srcObject = this.stream;
    await video.play();
    this.phase.set('live');
    this.frames = [];
    this.loop();
  }

  protected stop(): void {
    cancelAnimationFrame(this.frame);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    const video = this.video()?.nativeElement;
    if (video) video.srcObject = null;
    this.scene.set([]);
    this.latest = null;
    if (this.phase() === 'live') this.phase.set('idle');
  }

  protected async flip(): Promise<void> {
    this.facing.update((f) => (f === 'user' ? 'environment' : 'user'));
    if (this.phase() === 'live') {
      this.stop();
      await this.start();
    }
  }

  private loop = (): void => {
    const video = this.video()?.nativeElement;
    if (!video || !this.detector || this.phase() !== 'live') return;
    if (video.readyState >= 2 && video.videoWidth) {
      const now = performance.now();
      const result = this.detector.detect(video, now);
      this.latest = result;
      this.draw(result, video);
      this.frames.push(now);
      while (this.frames.length && now - this.frames[0] > 1000) this.frames.shift();
      if (now - this.lastPanel > PANEL_MS) {
        this.lastPanel = now;
        this.fps.set(this.frames.length);
        this.ms.set(Math.round(result.ms));
        this.scene.set(result.objects.sort((a, b) => Number(b.inHand) - Number(a.inHand) || b.score - a.score));
      }
    }
    this.frame = requestAnimationFrame(this.loop);
  };

  /** Dibuja cajas y manos. Con la cámara frontal el video se ve en espejo: se reflejan las x. */
  private draw(result: FrameResult, video: HTMLVideoElement): void {
    const canvas = this.canvas()!.nativeElement;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);
    const mirror = this.facing() === 'user';
    const mx = (x: number, width = 0) => (mirror ? w - x - width : x);
    const scale = Math.max(1, w / 900);

    // Manos: esqueleto fino en verde.
    ctx.strokeStyle = LIME;
    ctx.fillStyle = LIME;
    ctx.lineWidth = 2 * scale;
    for (const hand of result.hands) {
      ctx.beginPath();
      for (const [a, b] of HAND_LINKS) {
        ctx.moveTo(mx(hand.points[a].x), hand.points[a].y);
        ctx.lineTo(mx(hand.points[b].x), hand.points[b].y);
      }
      ctx.stroke();
      for (const p of hand.points) ctx.fillRect(mx(p.x) - 2 * scale, p.y - 2 * scale, 4 * scale, 4 * scale);
    }

    // Objetos: el que está en la mano en naranja y más grueso.
    ctx.font = `700 ${Math.round(15 * scale)}px system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    for (const o of result.objects) {
      if (o.label === 'person') continue;
      const color = o.inHand ? ORANGE : LIME;
      const x = mx(o.x, o.w);
      ctx.strokeStyle = color;
      ctx.lineWidth = (o.inHand ? 4 : 2) * scale;
      ctx.strokeRect(x, o.y, o.w, o.h);
      const text = `${this.label(o.label)} ${Math.round(o.score * 100)}%`;
      const tw = ctx.measureText(text).width + 12 * scale;
      const th = 22 * scale;
      const ty = Math.max(0, o.y - th);
      ctx.fillStyle = color;
      ctx.fillRect(x, ty, tw, th);
      ctx.fillStyle = '#000';
      ctx.fillText(text, x + 6 * scale, ty + 4 * scale);
    }
  }

  // ── IA ────────────────────────────────────────────────────

  protected async ask(): Promise<void> {
    const video = this.video()?.nativeElement;
    if (!video || this.phase() !== 'live' || this.asking()) return;
    const t = this.t().vision;
    if (this.quota().remainingToday <= 0) {
      this.askError.set(t.noneLeft);
      return;
    }
    this.asking.set(true);
    this.askError.set(null);
    try {
      const image = snapshot(video);
      const detected = [...new Set((this.latest?.objects ?? []).map((o) => o.label))];
      const res = await this.api.fetch('/api/demos/vision', {
        method: 'POST',
        body: JSON.stringify({ image, lang: this.i18n.lang(), detected }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.askError.set(t.errors[body?.detail] ?? t.errors['default']);
        return;
      }
      this.answer.set(body.result as Description);
      this.quota.update((q) => ({ ...q, remainingToday: body.remainingToday }));
    } catch {
      this.askError.set(t.errors['default']);
    } finally {
      this.asking.set(false);
    }
  }
}

/** Cuadro actual, reducido a 640 px de ancho y comprimido hasta quedar por debajo de ~180 KB. */
function snapshot(video: HTMLVideoElement): string {
  const ratio = Math.min(1, 640 / video.videoWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * ratio);
  canvas.height = Math.round(video.videoHeight * ratio);
  canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
  let quality = 0.75;
  let url = canvas.toDataURL('image/jpeg', quality);
  while (url.length > 240_000 && quality > 0.35) {
    quality -= 0.1;
    url = canvas.toDataURL('image/jpeg', quality);
  }
  return url;
}
