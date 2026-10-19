import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { I18n } from '../i18n';
import { CUES } from './intro.cues';

/** Párrafos de la transcripción (índices de CUES donde empieza cada uno). */
const PARAGRAPHS = [0, 6, 10, 14];

/**
 * /intro: el video de presentación para postulaciones. Se abre en inglés si el visitante no eligió
 * idioma (el video está en inglés); la transcripción sigue al video y sirve para saltar a un momento.
 */
@Component({
  selector: 'app-intro',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './intro.component.html',
  styleUrls: ['../demos/demo-shell.css', './intro.component.css'],
})
export class IntroComponent implements OnInit {
  protected readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;
  private readonly title = inject(Title);
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  protected readonly time = signal(0);
  protected readonly paragraphs = PARAGRAPHS.map((start, i) =>
    CUES.slice(start, PARAGRAPHS[i + 1] ?? CUES.length).map((cue, j) => ({ ...cue, index: start + j })),
  );
  protected readonly current = computed(() => {
    const t = this.time();
    if (t === 0) return -1;
    return CUES.findIndex((c) => t >= c.start && t < c.end);
  });

  constructor() {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('lang');
    } catch {
      // Sin almacenamiento: se respeta el idioma inicial.
    }
    if (!saved && this.i18n.lang() !== 'en') this.i18n.lang.set('en');
  }

  ngOnInit(): void {
    this.title.setTitle(this.t().intro.pageTitle);
  }

  protected onTime(): void {
    this.time.set(this.video().nativeElement.currentTime);
  }

  protected seek(start: number): void {
    const el = this.video().nativeElement;
    el.currentTime = start;
    void el.play().catch(() => undefined);
  }

  protected stamp(seconds: number): string {
    const s = Math.floor(seconds);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
}
