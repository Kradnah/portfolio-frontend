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
    {
        path: 'demos/llamadas',
        loadComponent: () => import('./demos/calls/call-lab.component').then(m => m.CallLabComponent)
    },
    {
        path: 'demos/facturas',
        loadComponent: () => import('./demos/invoices/invoice-lab.component').then(m => m.InvoiceLabComponent)
    },
    { path: '**', redirectTo: '/' }
];
