import { Component, OnInit, signal } from '@angular/core';

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
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.css',
})
export class ProjectsComponent implements OnInit {
  protected readonly apks = signal<ApkInfo[]>([]);
  protected readonly shot = signal(0);
  protected readonly rideShots = [
    { label: 'Dashboard', src: '/projects/rideapp-dashboard.webp', alt: 'Panel de rideapp: métricas del día y mapa de conductores en línea' },
    { label: 'Viajes', src: '/projects/rideapp-trips.webp', alt: 'Panel de rideapp: lista de viajes con estado y precio' },
    { label: 'Tarifas', src: '/projects/rideapp-fares.webp', alt: 'Panel de rideapp: tarifas versionadas por categoría' },
  ];

  async ngOnInit(): Promise<void> {
    try {
      const res = await fetch('/downloads/apks.json', { cache: 'no-cache' });
      if (res.ok) this.apks.set(((await res.json()) as { apks: ApkInfo[] }).apks);
    } catch {
      // Sin manifiesto (p. ej. en local) la tarjeta se muestra sin botones de descarga.
    }
  }

  protected mb(bytes: number): string {
    return `${Math.round(bytes / 1_000_000)} MB`;
  }
}
