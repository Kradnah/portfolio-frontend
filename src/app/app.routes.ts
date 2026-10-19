import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./landing/landing.component').then(m => m.LandingComponent)
    },
    {
        path: 'codigo/:slug',
        loadComponent: () => import('./code/code-viewer.component').then(m => m.CodeViewerComponent)
    },
    { path: '**', redirectTo: '/' }
];
