import { Component } from '@angular/core';

@Component({
  selector: 'app-contact',
  standalone: true,
  template: `
    <section class="section">
      <header class="section-head">
        <span class="kicker">03 · Contacto</span>
        <h2 class="section-title">¿Hablamos? <span class="hl">Estoy a un mensaje</span></h2>
        <p class="section-sub">Desarrollador Full-Stack en Bogotá, Colombia. Español e inglés.</p>
      </header>
      <div class="links">
        <a class="saas-btn-primary link" href="mailto:kradnah@gmail.com">kradnah&#64;gmail.com</a>
        <a class="saas-btn-accent link" href="https://www.linkedin.com/in/julian-lizcano" target="_blank" rel="noopener">LinkedIn ↗</a>
        <a class="saas-btn link" href="/cv/Julian_Lizcano_CV.pdf" download>Descargar CV (PDF)</a>
      </div>
      <p class="footer">© {{ year }} Julian Lizcano · Hecho con Angular y FastAPI en mi propio servidor.</p>
    </section>
  `,
  styles: `
    :host { display: block; background: #111; color: #fff; }
    :host .section-sub { color: #ccc; }
    .links { display: flex; flex-wrap: wrap; gap: 16px; }
    .link { display: inline-block; padding: 14px 26px; text-decoration: none; color: #000; font-weight: 800; }
    .saas-btn-primary.link { color: #fff; }
    .footer { margin: 56px 0 0; font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #aaa; }
  `,
})
export class ContactComponent {
  protected readonly year = new Date().getFullYear();
}
