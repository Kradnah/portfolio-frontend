import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';
import { Observable } from 'rxjs';

export interface Plantilla {
  id: number;
  id_cliente: number;
  nombre: string;
  descripcion: string;
  mensaje_final: string;
  tipo_archivo: string | null;
  ruta_multimedia: string | null;
  estado: number;
  id_last_user_updated: number;
  created_at: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class PlantillasService {
  private apiUrl = 'https://api.kodizof.com/plantillas';

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders() {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.authService.getToken()}`
    });
  }

  getPlantillas(): Observable<Plantilla[]> {
    return this.http.get<Plantilla[]>(this.apiUrl, { headers: this.getHeaders() });
  }

  getPlantillasActivas(): Observable<Plantilla[]> {
    return this.http.get<Plantilla[]>(`${this.apiUrl}/activas`, { headers: this.getHeaders() });
  }

  getPlantilla(id: number): Observable<Plantilla> {
    return this.http.get<Plantilla>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
  }

  createPlantilla(formData: FormData): Observable<Plantilla> {
    return this.http.post<Plantilla>(this.apiUrl, formData, {
      headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.getToken()}` })
    });
  }

  updatePlantilla(id: number, formData: FormData): Observable<Plantilla> {
    return this.http.put<Plantilla>(`${this.apiUrl}/${id}`, formData, {
      headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.getToken()}` })
    });
  }

  deletePlantilla(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
  }

  /** Construir URL pública para un archivo de plantilla */
  getMediaUrl(rutaMultimedia: string | null): string {
    if (!rutaMultimedia) return '';
    if (rutaMultimedia.startsWith('http')) return rutaMultimedia;
    return `https://api.kodizof.com/uploads/${rutaMultimedia}`;
  }
}
