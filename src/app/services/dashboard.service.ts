import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface DashboardReporteConsolidado {
    id_cliente: number;
    nombre_empresa: string;
    total_conversaciones: string;
    total_mensajes_wpp: string;
    wpp_enviados: string;
    wpp_recibidos: string;
    total_mensajes_fb: string;
    fb_enviados: string;
    fb_recibidos: string;
    total_mensajes_ig: string;
    ig_enviados: string;
    ig_recibidos: string;
}

@Injectable({
    providedIn: 'root'
})
export class DashboardService {
    private http = inject(HttpClient);
    private apiUrl = 'https://api.kodizof.com/dashboard';

    getReporteConsolidado() {
        return this.http.get<DashboardReporteConsolidado[]>(`${this.apiUrl}/reporte-consolidado`);
    }

    getConversacionesPorCliente() {
        return this.http.get<any[]>(`${this.apiUrl}/conversaciones-por-cliente`);
    }

    getMensajesWhatsapp() {
        return this.http.get<any[]>(`${this.apiUrl}/mensajes-whatsapp`);
    }

    getMensajesFb() {
        return this.http.get<any[]>(`${this.apiUrl}/mensajes-fb`);
    }

    getMensajesIg() {
        return this.http.get<any[]>(`${this.apiUrl}/mensajes-ig`);
    }
}
