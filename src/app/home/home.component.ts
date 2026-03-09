import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { DashboardService, DashboardReporteConsolidado } from '../services/dashboard.service';
import { ChatService, Conversation, Message } from '../services/chat.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './home.component.html',
    styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy {
    authService = inject(AuthService);
    dashboardService = inject(DashboardService);
    chatService = inject(ChatService);

    // Global stats
    totalConversaciones = 0;
    totalWppMensajes = 0;
    totalMetaMensajes = 0;

    // Table data
    reporteConsolidado: DashboardReporteConsolidado[] = [];
    idEmpresa: number = 0;

    // Chat data
    activeTab: 'OPEN' | 'CLOSED' = 'OPEN';
    conversations: Conversation[] = [];
    selectedConversation: Conversation | null = null;
    messages: Message[] = [];
    wsSubscription: Subscription | null = null;

    ngOnInit() {
        const userInfo = this.authService.getCurrentUser();
        if (userInfo && userInfo.id_empresa) {
            this.idEmpresa = userInfo.id_empresa;
        }

        this.loadDashboardData();
        this.loadConversations();

        // Subscribe to WebSocket messages
        this.wsSubscription = this.chatService.messages$.subscribe((msg: any) => {
            console.log("Componente recibió mensaje del WS:", msg);
            // Si el mensaje parseado es para la conversacion actual, lo agregamos
            if (this.selectedConversation && msg.id_conversacion === this.selectedConversation.id) {
                // To support both backend message formats if differs mildly
                const newMsg: Message = {
                    id: msg.id || Date.now(),
                    id_conversacion: msg.id_conversacion,
                    message_id: msg.message_id || '',
                    mensaje: msg.mensaje,
                    plataforma: msg.plataforma || '',
                    envia: msg.envia || '',
                    recibe: msg.recibe || '',
                    procesado: msg.procesado || 1,
                    created_at: msg.created_at || new Date().toISOString(),
                    updated_at: msg.updated_at || new Date().toISOString(),
                    ruta_multimedia: msg.ruta_multimedia || ''
                };
                this.messages.push(newMsg);
                this.scrollToBottom();
            }
        });
    }

    ngOnDestroy() {
        if (this.wsSubscription) {
            this.wsSubscription.unsubscribe();
        }
        this.chatService.disconnect();
    }

    loadDashboardData() {
        this.dashboardService.getReporteConsolidado().subscribe({
            next: (data) => {
                this.reporteConsolidado = data;
                this.calculateTotals(data);
            },
            error: (err) => {
                console.error('Error fetching dashboard data', err);
            }
        });
    }

    // --- Chat Logic ---

    setTab(tab: 'OPEN' | 'CLOSED') {
        this.activeTab = tab;
        this.selectedConversation = null;
        this.messages = [];
        this.chatService.disconnect();
        this.loadConversations();
    }

    loadConversations() {
        if (!this.idEmpresa) return;
        this.chatService.getConversations(this.idEmpresa, this.activeTab).subscribe({
            next: (data) => {
                this.conversations = data;
            },
            error: (err) => console.error("Error loading conversations", err)
        });
    }

    selectConversation(conv: Conversation) {
        this.selectedConversation = conv;
        this.messages = [];
        this.chatService.getMessages(conv.id).subscribe({
            next: (data) => {
                this.messages = data;
                this.scrollToBottom();
            },
            error: (err) => console.error("Error loading messages", err)
        });

        // Conectar WebSocket si está abierta
        if (this.activeTab === 'OPEN') {
            this.chatService.connectToConversation(conv.id);
        } else {
            this.chatService.disconnect();
        }
    }

    takeConversation() {
        if (!this.selectedConversation) return;

        const userInfo = this.authService.getCurrentUser();
        const idAgente = userInfo?.id || 1; // Fallback a 1 si no hay id real

        this.chatService.takeConversation(this.selectedConversation.id, idAgente).subscribe({
            next: (resp) => {
                if (this.selectedConversation) {
                    this.selectedConversation.estado = 'ATTENDING';
                }
                // Recargar lista
                this.loadConversations();
            },
            error: (err) => console.error("Error taking conversation", err)
        });
    }

    scrollToBottom() {
        setTimeout(() => {
            const el = document.getElementById('chat-messages-container');
            if (el) {
                el.scrollTop = el.scrollHeight;
            }
        }, 100);
    }

    calculateTotals(data: DashboardReporteConsolidado[]) {
        this.totalConversaciones = data.reduce((sum, item) => sum + Number(item.total_conversaciones || 0), 0);
        this.totalWppMensajes = data.reduce((sum, item) => sum + Number(item.total_mensajes_wpp || 0), 0);
        this.totalMetaMensajes = data.reduce((sum, item) => sum + Number(item.total_mensajes_meta || 0), 0);
    }

    logout() {
        this.authService.logout();
    }
}
