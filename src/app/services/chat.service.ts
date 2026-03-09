import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';

export interface Conversation {
  id: number;
  user_name: string;
  id_wpp: string;
  num_wpp: string;
  num_agente: string;
  agente_atendio: number;
  user_control: string;
  estado: string;
  validar_atencion: number;
  data_recordar: any;
  created_at: string;
  updated_at: string;
  plataforma: string;
  nombre_agente?: string;
}

export interface Message {
  id: number;
  id_conversacion: number;
  message_id: string;
  mensaje: string;
  plataforma: string;
  envia: string;
  recibe: string;
  procesado: number;
  created_at: string;
  updated_at: string;
  ruta_multimedia: string;
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private http = inject(HttpClient);
  // NestJS Backend URL
  private apiUrl = 'https://api.kodizof.com/conversations';
  // FastAPI WebSocket URL
  private wsUrl = 'wss://webhook.kodizof.com/api/ws/conversations';
  
  private socket: WebSocket | null = null;
  
  // Observable for new incoming WebSocket messages
  private messageSubject = new Subject<any>();
  public messages$ = this.messageSubject.asObservable();

  getConversations(idEmpresa: number, status: string = 'OPEN'): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${this.apiUrl}?id_empresa=${idEmpresa}&status=${status}`);
  }

  getMessages(idConversacion: number): Observable<Message[]> {
    return this.http.get<Message[]>(`${this.apiUrl}/${idConversacion}/messages`);
  }

  takeConversation(idConversacion: number, idAgente: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${idConversacion}/take`, { id_agente: idAgente });
  }

  changeConversationState(idConversacion: number, estado: string): Observable<any> {
    const webhookApiUrl = 'https://webhook.kodizof.com/api';
    return this.http.put<any>(`${webhookApiUrl}/conversations/${idConversacion}/state`, { estado });
  }

  sendMessage(idConversacion: number, text: string): Observable<any> {
    const webhookApiUrl = 'https://webhook.kodizof.com/api';
    return this.http.post<any>(`${webhookApiUrl}/messages/send`, { conv_id: idConversacion, text });
  }

  connectToConversation(idConversacion: number) {
    this.disconnect(); // Ensure previous connection is closed

    this.socket = new WebSocket(`${this.wsUrl}/${idConversacion}`);

    this.socket.onopen = (e) => {
      console.log(`¡Conectado al chat en tiempo real para la conversación ${idConversacion}!`);
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === "new_message") {
          console.log("¡Llegó un nuevo mensaje de WS!", data.message);
          this.messageSubject.next(data.message);
        }
      } catch(e) {
        console.error("Error parsing WS message", e);
      }
    };

    this.socket.onclose = (event) => {
      if (event.wasClean) {
        console.log(`Conexión cerrada limpiamente, código=${event.code} motivo=${event.reason}`);
      } else {
        console.log('La conexión se cortó bruscamente');
      }
    };

    this.socket.onerror = (error: any) => {
      console.log(`[error] WebSocket Error: `, error);
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
