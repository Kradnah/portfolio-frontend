import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
    providedIn: 'root'
})
export class UserService {
    private http = inject(HttpClient);
    private authService = inject(AuthService);
    private backendUrl = 'https://api.kodizof.com/usuarios';

    private getHeaders() {
        const token = this.authService.getToken();
        return {
            headers: new HttpHeaders({
                'Authorization': `Bearer ${token}`
            })
        };
    }

    getUsers(): Observable<any[]> {
        return this.http.get<any[]>(this.backendUrl, this.getHeaders());
    }

    getEmpresas(): Observable<any[]> {
        return this.http.get<any[]>(`${this.backendUrl}/empresas`, this.getHeaders());
    }

    createUser(user: any): Observable<any> {
        return this.http.post<any>(this.backendUrl, user, this.getHeaders());
    }

    updateUser(id: number, user: any): Observable<any> {
        return this.http.put<any>(`${this.backendUrl}/${id}`, user, this.getHeaders());
    }
}
