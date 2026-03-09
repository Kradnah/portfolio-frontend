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
    private backendUrl = 'http://localhost:3000/auth';

    login(username: string, password: string): Observable<any> {
        return this.http.post<any>(`${this.backendUrl}/login`, { username, password })
            .pipe(
                tap(res => {
                    if (res.access_token) {
                        localStorage.setItem('token', res.access_token);
                        this.router.navigate(['/home']);
                    }
                })
            );
    }

    logout() {
        localStorage.removeItem('token');
        this.router.navigate(['/login']);
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
