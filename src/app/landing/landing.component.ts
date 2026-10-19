import { Component, ElementRef, computed, inject } from '@angular/core';
import { I18n } from '../i18n';
import { AskAiComponent } from '../ask-ai/ask-ai.component';
import { ContactComponent } from '../contact/contact.component';
import { ExperienceComponent } from '../experience/experience.component';
import { LabComponent } from '../lab/lab.component';
import { ProjectsComponent } from '../projects/projects.component';
import { StackCardComponent } from '../stack-card/stack-card.component';

/** Repite la lista para que la cinta tenga el doble de ancho y el bucle (−50 %) no se note. */
const loop = (words: string[]) => [...words, ...words, ...words, ...words];

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [ExperienceComponent, ProjectsComponent, LabComponent, AskAiComponent, ContactComponent, StackCardComponent],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css', './landing.motion.css'],
})
export class LandingComponent {
  protected readonly headline = [...'Full-Stack'];
  protected readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;
  protected readonly marqueeA = computed(() => loop(this.t().hero.marqueeA));
  protected readonly marqueeB = computed(() => loop(this.t().hero.marqueeB));

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly parallax =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(pointer: fine) and (min-width: 1101px) and (prefers-reduced-motion: no-preference)').matches;
  private frame = 0;

  /** Parallax: pasa la posición del mouse (−1…1) a --mx/--my en .page. */
  protected onPointerMove(e: PointerEvent): void {
    if (!this.parallax || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.setVars((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    });
  }

  protected resetParallax(): void {
    if (this.parallax) this.setVars(0, 0);
  }

  private setVars(x: number, y: number): void {
    const page = (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('.page');
    page?.style.setProperty('--mx', x.toFixed(3));
    page?.style.setProperty('--my', y.toFixed(3));
  }
}
