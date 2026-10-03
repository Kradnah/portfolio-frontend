import { Component } from '@angular/core';
import { AskAiComponent } from '../ask-ai/ask-ai.component';
import { ContactComponent } from '../contact/contact.component';
import { ProjectsComponent } from '../projects/projects.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [ProjectsComponent, AskAiComponent, ContactComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent {}
