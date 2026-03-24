import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private http = inject(HttpClient);
    private router = inject(Router);
    private backendUrl = 'https://api.kodizof.com/auth';
    private autoLogoutTimer: any;

    constructor() {
        if (this.isLoggedIn()) {
            this.startAutoLogoutTimer();
        }
    }

    login(username: string, password: string): Observable<any> {
        return this.http.post<any>(`${this.backendUrl}/login`, { username, password })
            .pipe(
                tap(res => {
                    if (res.access_token) {
                        localStorage.setItem('token', res.access_token);
                        this.startAutoLogoutTimer();
                        this.router.navigate(['/home']);
                    }
                })
            );
    }

    logout() {
        localStorage.removeItem('token');
        if (this.autoLogoutTimer) clearTimeout(this.autoLogoutTimer);
        this.router.navigate(['/login']);
    }

    startAutoLogoutTimer() {
        const payload = this.getCurrentUser();
        // 45 minutos (en milisegundos)
        const logoutDuration = 45 * 60 * 1000;

        if (payload && payload.iat) {
            const issueTime = payload.iat * 1000;
            const logoutTime = issueTime + logoutDuration;
            const timeUntilLogout = logoutTime - Date.now();

            if (timeUntilLogout > 0) {
                if (this.autoLogoutTimer) clearTimeout(this.autoLogoutTimer);
                this.autoLogoutTimer = setTimeout(() => {
                    alert('Tu sesión ha expirado por seguridad (45 mins). Por favor, inicia sesión nuevamente para continuar enviado mensajes al CRM.');
                    this.logout();
                }, timeUntilLogout);
            } else {
                // Ya pasaron 45 min desde que se creó el token
                this.logout();
            }
        } else {
            // Fallback genérico a 45 minutos desde que carga la página
            if (this.autoLogoutTimer) clearTimeout(this.autoLogoutTimer);
            this.autoLogoutTimer = setTimeout(() => {
                alert('Tu sesión ha expirado por seguridad (45 mins). Por favor, inicia sesión nuevamente.');
                this.logout();
            }, logoutDuration);
        }
    }

    getToken(): string | null {
        return localStorage.getItem('token');
    }

    isLoggedIn(): boolean {
        return !!this.getToken();
    }

    getCurrentUser(): any {
        const token = this.getToken();
        if (!token) return null;
        try {
            // Un token JWT es un string xxxx.yyyy.zzzz. La data está en yyyy (base64url encoded).
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));

            return JSON.parse(jsonPayload);
        } catch (e) {
            console.error('Error decoding token', e);
            return null;
        }
    }
}
