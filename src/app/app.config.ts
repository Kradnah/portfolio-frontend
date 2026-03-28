import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { LucideAngularModule, LayoutDashboard, Users, Settings, LogOut, KeyRound, Sun, Moon, MessageCircle, Facebook, Instagram, Phone, X, Paperclip, Send, Menu } from 'lucide-angular';

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    importProvidersFrom(LucideAngularModule.pick({ LayoutDashboard, Users, Settings, LogOut, KeyRound, Sun, Moon, MessageCircle, Facebook, Instagram, Phone, X, Paperclip, Send, Menu }))
  ]
};
