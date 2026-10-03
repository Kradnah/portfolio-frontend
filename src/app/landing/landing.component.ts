import { Component } from '@angular/core';

/** Demo en vivo de Coral, el CRM conversacional con IA (repo D:\Server\Coral). */
const CORAL_URL = 'https://crm.julian-lizcano.com';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent {
  openCoral() {
    window.open(CORAL_URL, '_blank', 'noopener');
  }
}
