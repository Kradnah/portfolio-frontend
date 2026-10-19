import { Component, inject } from '@angular/core';
import { I18n } from '../i18n';
import { RevealDirective } from '../reveal.directive';

@Component({
  selector: 'app-experience',
  standalone: true,
  imports: [RevealDirective],
  template: `
    <section class="section">
      <header class="section-head" appReveal>
        <span class="kicker">{{ t().experience.kicker }}</span>
        <h2 class="section-title">{{ t().experience.title }} <span class="hl">{{ t().experience.titleHl }}</span></h2>
        <p class="section-sub">{{ t().experience.sub }}</p>
      </header>

      <ol class="timeline">
        @for (job of t().experience.jobs; track job.company; let i = $index) {
          <li class="job saas-card" [class.lead]="job.stat" [appReveal]="i * 120">
            <div class="head">
              <span class="dates">{{ job.dates }}</span>
              <span class="place">{{ job.place }}</span>
            </div>
            <div class="main">
              <div class="info">
                <h3 class="role">{{ job.role }}</h3>
                <p class="company">{{ job.company }}</p>
                <ul class="points">
                  @for (p of job.points; track $index) {<li>{{ p }}</li>}
                </ul>
                <ul class="stack">
                  @for (s of job.stack; track s) {<li>{{ s }}</li>}
                </ul>
              </div>
              @if (job.stat; as stat) {
                <div class="stat">
                  <span class="stat-value">{{ stat.value }}</span>
                  <span class="stat-label">{{ stat.label }}</span>
                </div>
              }
            </div>
          </li>
        }
      </ol>

      <div class="edu" appReveal="200">
        <h3 class="edu-title">{{ t().experience.eduTitle }}</h3>
        <ul class="edu-list">
          @for (e of t().experience.edu; track e.title) {
            <li>
              <strong>{{ e.title }}</strong>
              <span>{{ e.place }} · {{ e.when }}</span>
            </li>
          }
        </ul>
      </div>
    </section>
  `,
  styles: `
    /* Paleta inspirada en Evangelion: morado y verde del EVA-01, naranja/rojo de las alertas de NERV. */
    :host {
      --eva-purple: #2a1745;
      --eva-purple-deep: #160b26;
      --eva-purple-mid: #6b3fa0;
      --eva-green: #8be000;
      --eva-orange: #ff7a00;
      --eva-red: #e0233c;
      --eva-text: #ece6f5;
      display: block; position: relative; color: var(--eva-text);
      background:
        radial-gradient(circle at 85% 10%, rgb(107 63 160 / 0.35), transparent 45%),
        var(--eva-purple);
      border-top: 2.5px solid #000; border-bottom: 2.5px solid #000;
    }
    /* Franja de peligro arriba y abajo, como las señales de NERV */
    :host::before, :host::after {
      content: ''; position: absolute; left: 0; right: 0; height: 12px;
      background: repeating-linear-gradient(-45deg, var(--eva-orange) 0 14px, #000 14px 28px);
    }
    :host::before { top: 0; }
    :host::after { bottom: 0; }

    .section-sub { color: #cbbde0; }
    .section-head.reveal .section-title .hl {
      color: #000;
      background: linear-gradient(var(--eva-orange), var(--eva-orange)) no-repeat left / 0% 100%;
    }
    .section-head.reveal.is-visible .section-title .hl { background-size: 100% 100%; }

    .timeline { list-style: none; margin: 0; padding: 0 0 0 28px; display: grid; gap: 28px; border-left: 4px solid var(--eva-green); }
    .job.saas-card { position: relative; background: var(--eva-purple-deep); border-color: #000; box-shadow: 8px 8px 0 #000; }
    .job.saas-card.reveal.is-visible:hover { box-shadow: 10px 10px 0 var(--eva-green); }
    .job::before {
      content: ''; position: absolute; left: -45px; top: 14px;
      width: 22px; height: 22px; background: var(--eva-green); border: 3px solid #000;
    }
    .job.lead::before { background: var(--eva-red); }

    .head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; padding: 8px 18px; background: var(--eva-orange); color: #000; font-family: 'Courier New', Courier, monospace; font-weight: 700; font-size: 13px; letter-spacing: 0.04em; }
    .place { text-transform: uppercase; }

    .main { display: grid; grid-template-columns: 1fr auto; gap: 24px; padding: 22px 24px 24px; }
    .role { margin: 0; font-size: 26px; font-weight: 900; font-style: italic; line-height: 1.15; color: #fff; }
    .company { margin: 4px 0 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; font-size: 13px; color: var(--eva-green); }
    .points { margin: 0 0 16px; padding-left: 18px; line-height: 1.55; font-size: 15px; display: grid; gap: 6px; }
    .points li::marker { color: var(--eva-orange); }

    .stack { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; margin: 0; padding: 0; }
    .stack li { font-family: 'Courier New', Courier, monospace; font-size: 12px; font-weight: 700; background: transparent; color: var(--eva-green); border: 1.5px solid var(--eva-green); padding: 2px 7px; }

    .stat {
      align-self: start; width: 240px; padding: 18px; display: grid; gap: 8px;
      background: #000; color: #fff; border: 2.5px solid var(--eva-orange); box-shadow: 6px 6px 0 var(--eva-purple-mid); rotate: 2deg;
    }
    .stat-value { white-space: nowrap; font-size: 30px; font-weight: 900; font-style: italic; line-height: 1; color: var(--eva-orange); }
    .stat-value::after { content: '/mes'; font-size: 15px; margin-left: 4px; color: #fff; }
    :host-context(html[lang='en']) .stat-value::after { content: '/mo'; }
    .stat-label { font-size: 13px; font-weight: 700; line-height: 1.35; color: var(--eva-green); }

    .edu { margin-top: 48px; }
    .edu-title { display: inline-block; margin: 0 0 16px; background: var(--eva-green); color: #000; padding: 4px 12px; font-size: 18px; font-weight: 900; font-style: italic; }
    .edu-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 16px; }
    .edu-list li { display: grid; gap: 4px; padding: 14px 16px; background: var(--eva-purple-deep); border: 2.5px solid #000; border-left: 6px solid var(--eva-orange); }
    .edu-list strong { color: #fff; }
    .edu-list span { font-family: 'Courier New', Courier, monospace; font-size: 13px; color: #cbbde0; }

    @media (max-width: 760px) {
      .main { grid-template-columns: 1fr; }
      .stat { width: auto; rotate: 0deg; order: -1; }
    }
    @media (max-width: 640px) {
      .timeline { padding-left: 18px; }
      .job::before { left: -31px; width: 16px; height: 16px; }
      .role { font-size: 22px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .section-head.reveal .section-title .hl { background-size: 100% 100%; }
    }
  `,
})
export class ExperienceComponent {
  protected readonly t = inject(I18n).t;
}
