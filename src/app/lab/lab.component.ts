import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18n } from '../i18n';
import { RevealDirective } from '../reveal.directive';

@Component({
  selector: 'app-lab',
  standalone: true,
  imports: [RevealDirective, RouterLink],
  template: `
    <section class="section">
      <header class="section-head" appReveal>
        <span class="kicker">{{ t().lab.kicker }}</span>
        <h2 class="section-title">{{ t().lab.title }} <span class="hl">{{ t().lab.titleHl }}</span></h2>
        <p class="section-sub">{{ t().lab.sub }}</p>
      </header>
      <div class="grid">
        <a class="demo saas-card" routerLink="/demos/llamadas" appReveal="0">
          <span class="tag live">{{ t().lab.live }}</span>
          <h3>{{ t().lab.callsTitle }}</h3>
          <p>{{ t().lab.callsDesc }}</p>
          <ul class="stack"><li>Whisper</li><li>transformers.js</li><li>FastAPI</li><li>LLM</li></ul>
          <span class="cta">{{ t().lab.callsCta }}</span>
        </a>
        <div class="demo saas-card soon" appReveal="150">
          <span class="tag">{{ t().lab.soon }}</span>
          <h3>{{ t().lab.invoiceTitle }}</h3>
          <p>{{ t().lab.invoiceDesc }}</p>
          <ul class="stack"><li>pdf.js</li><li>tesseract.js</li><li>LLM</li></ul>
        </div>
      </div>
    </section>
  `,
  styles: `
    :host { display: block; background: #160b26; color: #ece6f5; border-top: 2.5px solid #000; }
    .section-sub { color: #cbbde0; }
    .section-head.reveal .section-title .hl { color: #000; background: linear-gradient(#8be000, #8be000) no-repeat left / 0% 100%; }
    .section-head.reveal.is-visible .section-title .hl { background-size: 100% 100%; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap: 28px; }
    .demo.saas-card { display: flex; flex-direction: column; gap: 12px; padding: 26px; background: #2a1745; color: inherit; text-decoration: none; border-color: #000; box-shadow: 8px 8px 0 #000; }
    a.demo.saas-card.reveal.is-visible:hover { box-shadow: 10px 10px 0 #8be000; }
    .demo h3 { margin: 0; font-size: 28px; font-weight: 900; font-style: italic; color: #fff; }
    .demo p { margin: 0; line-height: 1.55; }
    .tag { align-self: flex-start; border: 2px solid #000; padding: 2px 10px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; background: #b8a8d4; color: #000; }
    .tag.live { background: #8be000; }
    .stack { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; margin: 0; padding: 0; }
    .stack li { font-family: 'Courier New', Courier, monospace; font-size: 12px; font-weight: 700; color: #8be000; border: 1.5px solid #8be000; padding: 2px 7px; }
    .cta { margin-top: auto; align-self: flex-start; padding: 10px 18px; background: #ff7a00; color: #000; font-weight: 900; border: 2px solid #000; }
    .soon { opacity: 0.75; }
    @media (prefers-reduced-motion: reduce) { .section-head.reveal .section-title .hl { background-size: 100% 100%; } }
  `,
})
export class LabComponent {
  protected readonly t = inject(I18n).t;
}
