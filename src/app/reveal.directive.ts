import { Directive, ElementRef, OnDestroy, OnInit, inject, input } from '@angular/core';

/** Añade `.is-visible` cuando el elemento entra en pantalla (una sola vez); el estilo vive en styles.css. */
@Directive({
  selector: '[appReveal]',
  standalone: true,
  host: { class: 'reveal', '[style.--reveal-delay]': 'delay() + "ms"' },
})
export class RevealDirective implements OnInit, OnDestroy {
  /** Retraso en ms, para escalonar varios elementos. */
  readonly delay = input(0, { alias: 'appReveal', transform: (v: unknown) => Number(v) || 0 });

  private readonly el = inject(ElementRef<HTMLElement>);
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    const node = this.el.nativeElement as HTMLElement;
    if (typeof IntersectionObserver === 'undefined') {
      node.classList.add('is-visible');
      return;
    }
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          node.classList.add('is-visible');
          this.observer?.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    this.observer.observe(node);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
