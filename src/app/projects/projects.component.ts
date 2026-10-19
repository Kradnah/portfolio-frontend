import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18n } from '../i18n';
import { RevealDirective } from '../reveal.directive';

/** Lo publica `scripts/publish-apks.sh` junto a las APK en /downloads/. */
interface ApkInfo {
  app: 'pasajero' | 'conductor';
  version: string;
  file: string;
  bytes: number;
}

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [RevealDirective, RouterLink],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.css',
})
export class ProjectsComponent implements OnInit {
  protected readonly apks = signal<ApkInfo[]>([]);
  protected readonly shot = signal(0);
  protected readonly t = inject(I18n).t;
  /** Capturas del panel; la etiqueta y el alt de cada una vienen de t().projects.rideShots. */
  protected readonly rideShots = [
    { src: '/projects/rideapp-dashboard.webp' },
    { src: '/projects/rideapp-trips.webp' },
    { src: '/projects/rideapp-fares.webp' },
  ];

  async ngOnInit(): Promise<void> {
    try {
      const res = await fetch('/downloads/apks.json', { cache: 'no-cache' });
      if (res.ok) this.apks.set(((await res.json()) as { apks: ApkInfo[] }).apks);
    } catch {
      // Sin manifiesto (p. ej. en local) la tarjeta se muestra sin botones de descarga.
    }
  }

  /** Abre el widget de Coral (cargado en la portada) sin salir de la página. */
  protected openCoralChat(): void {
    const launcher = document.querySelector('coral-chat-host')?.shadowRoot?.querySelector<HTMLButtonElement>('.launcher');
    if (launcher) launcher.click();
    else window.open('https://crm.julian-lizcano.com', '_blank', 'noopener');
  }

  protected mb(bytes: number): string {
    return `${Math.round(bytes / 1_000_000)} MB`;
  }
}
