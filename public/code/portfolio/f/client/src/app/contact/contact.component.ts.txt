import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18n } from '../i18n';
import { RevealDirective } from '../reveal.directive';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [RevealDirective, RouterLink],
  template: `
    <section class="section">
      <header class="section-head" appReveal>
        <span class="kicker">{{ t().contact.kicker }}</span>
        <h2 class="section-title">{{ t().contact.title }} <span class="hl">{{ t().contact.titleHl }}</span></h2>
        <p class="section-sub">{{ t().contact.sub }}</p>
        <p class="open-badge contact-open"><span class="open-dot" aria-hidden="true"></span>{{ t().contact.available }}</p>
      </header>
      <div class="links" appReveal="200">
        <a class="saas-btn-primary link" href="mailto:kradnah@gmail.com">kradnah&#64;gmail.com</a>
        <a class="saas-btn-accent link" href="https://www.linkedin.com/in/julian-lizcano" target="_blank" rel="noopener">LinkedIn ↗</a>
        <a class="saas-btn link" [href]="t().cvUrl" download>{{ t().contact.cv }}</a>
      </div>
      <p class="footer">© {{ year }} Julian Lizcano · {{ t().contact.footer }} <a routerLink="/codigo/portfolio">{{ t().contact.footerCode }} &lt;/&gt;</a></p>
    </section>
  `,
  styles: `
    :host { display: block; background: #111; color: #fff; }
    :host .section-sub { color: #ccc; }
    .contact-open { margin-top: 22px; }
    .links { display: flex; flex-wrap: wrap; gap: 16px; }
    .link { display: inline-block; padding: 14px 26px; text-decoration: none; color: #000; font-weight: 800; }
    .saas-btn-primary.link { color: #fff; }
    .footer a { color: var(--lime); }
    .footer { margin: 56px 0 0; font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #aaa; }
  `,
})
export class ContactComponent {
  protected readonly t = inject(I18n).t;
  protected readonly year = new Date().getFullYear();
}
