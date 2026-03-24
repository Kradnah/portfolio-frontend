import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { DashboardService, DashboardReporteConsolidado } from '../services/dashboard.service';
import { ChatService, Conversation, Message } from '../services/chat.service';
import { UserService } from '../services/user.service';
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
    userService = inject(UserService);
    private cdr = inject(ChangeDetectorRef);

    // User Roles and Views
    userTipo: string = 'vendedor';
    currentView: 'dashboard' | 'users' = 'dashboard';

    // User management data
    usuarios: any[] = [];
    empresas: any[] = [];
    showUserModal: boolean = false;
    editingUserId: number | null = null;
    userForm: any = {
        nombre: '',
        usuario: '',
        password: '',
        tipo: 'vendedor',
        id_empresa: null
    };

    // Global stats
    totalConversaciones = 0;
    totalWppMensajes = 0;
    totalFbMensajes = 0;
    totalIgMensajes = 0;

    // Table data
    reporteConsolidado: DashboardReporteConsolidado[] = [];
    idEmpresa: number = 0;

    // Chat data
    activeTab: 'OPEN' | 'ATTENDING' | 'CLOSE' = 'OPEN';
    conversations: Conversation[] = [];
    selectedConversation: Conversation | null = null;
    messages: Message[] = [];
    wsSubscription: Subscription | null = null;
    dashboardWsSubscription: Subscription | null = null;
    refreshInterval: any;
    newMessageText: string = '';
    isSending: boolean = false;
    selectedFile: File | null = null;

    ngOnInit() {
        const userInfo = this.authService.getCurrentUser();
        if (userInfo && userInfo.id_empresa) {
            this.idEmpresa = userInfo.id_empresa;
            this.userTipo = userInfo.tipo || 'vendedor';
        }

        if (this.userTipo === 'admin') {
            this.loadUsers();
            this.loadEmpresas();
        }

        this.loadDashboardData();
        this.loadConversations();
        
        // Timeout de fallback para asegurar que si algo falló rápido al inicio, se vuelva a pedir (ej interceptor)
        setTimeout(() => {
            const ui = this.authService.getCurrentUser();
            if (ui && ui.id_empresa) this.idEmpresa = ui.id_empresa;
            this.loadDashboardData();
            this.loadConversations();
            this.cdr.detectChanges();
        }, 1000);

        // Suscribirse al WebSocket del Dashboard para actualizaciones en tiempo real
        this.chatService.connectToDashboard();
        this.dashboardWsSubscription = this.chatService.dashboardUpdates$.subscribe((msg: any) => {
            console.log("Dashboard WS actualiza:", msg);
            this.loadDashboardData();
            this.loadConversations();
            
            // Si hay una conversación abierta, recargamos sus mensajes por si acaso se perdió el evento WS específico
            if (this.selectedConversation) {
                this.chatService.getMessages(this.selectedConversation.id).subscribe({
                    next: (data) => {
                        this.messages = data;
                        this.scrollToBottom();
                        this.cdr.detectChanges();
                    }
                });
            }
        });

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
                this.cdr.detectChanges();
            }
        });
    }

    ngOnDestroy() {
        if (this.wsSubscription) {
            this.wsSubscription.unsubscribe();
        }
        if (this.dashboardWsSubscription) {
            this.dashboardWsSubscription.unsubscribe();
        }
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        this.chatService.disconnect();
        this.chatService.disconnectDashboard();
    }

    loadDashboardData() {
        this.dashboardService.getReporteConsolidado().subscribe({
            next: (data) => {
                this.reporteConsolidado = data;
                this.calculateTotals(data);
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error fetching dashboard data', err);
            }
        });
    }

    // --- Chat Logic ---

    setTab(tab: 'OPEN' | 'ATTENDING' | 'CLOSE') {
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
                this.cdr.detectChanges();
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
                this.cdr.detectChanges();
            },
            error: (err) => console.error("Error loading messages", err)
        });

        // Conectar WebSocket siempre que se seleccione una conversación
        this.chatService.connectToConversation(conv.id);
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

    changeState(newState: 'OPEN' | 'CLOSE') {
        if (!this.selectedConversation) return;
        this.chatService.changeConversationState(this.selectedConversation.id, newState).subscribe({
            next: () => {
                if (this.selectedConversation) {
                    this.selectedConversation.estado = newState;
                }
                this.loadConversations();
                this.selectedConversation = null;
            },
            error: (err) => console.error("Error changing state", err)
        });
    }

    sendMessage() {
        if (!this.selectedConversation || this.isSending) return;
        if (!this.newMessageText.trim() && !this.selectedFile) return;
        
        this.isSending = true;
        
        if (this.selectedFile) {
            // Send Media
            this.chatService.sendMediaMessage(this.selectedConversation.id, this.selectedFile).subscribe({
                next: (res) => {
                    this.isSending = false;
                    this.selectedFile = null;
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error("Error sending media", err);
                    this.isSending = false;
                    this.cdr.detectChanges();
                }
            });
        } else {
            // Send Text
            const textToSend = this.newMessageText.trim();
            this.newMessageText = '';

            this.chatService.sendMessage(this.selectedConversation.id, textToSend).subscribe({
                next: (res) => {
                    this.isSending = false;
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error("Error sending message", err);
                    this.isSending = false;
                    this.newMessageText = textToSend; 
                    this.cdr.detectChanges();
                }
            });
        }
    }

    onFileSelected(event: any) {
        if (event.target.files && event.target.files.length > 0) {
            this.selectedFile = event.target.files[0];
            this.cdr.detectChanges();
        }
    }

    removeFile() {
        this.selectedFile = null;
        this.cdr.detectChanges();
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
        this.totalFbMensajes = data.reduce((sum, item) => sum + Number(item.total_mensajes_fb || 0), 0);
        this.totalIgMensajes = data.reduce((sum, item) => sum + Number(item.total_mensajes_ig || 0), 0);
    }

    // --- Helpers para Multimedia ---
    getMediaUrl(ruta: string | null | undefined): string {
        if (!ruta) return '';
        if (ruta.startsWith('http')) return ruta;
        return ruta.replace('/app/multimedia', 'https://webhook.kodizof.com/api/multimedia');
    }

    isImage(ruta: string | null | undefined, mensaje?: string | null): boolean {
        if (mensaje && mensaje.includes('[Archivo Multimedia: image]')) return true;
        if (!ruta) return false;
        return /\.(jpg|jpeg|png|gif|webp)$/i.test(ruta);
    }

    isAudio(ruta: string | null | undefined, mensaje?: string | null): boolean {
        if (mensaje && (mensaje.includes('[Archivo Multimedia: audio]') || mensaje.includes('[Archivo Multimedia: voice]'))) return true;
        if (!ruta) return false;
        return /\.(mp3|wav|ogg|m4a|aac|oga)$/i.test(ruta) || ruta.includes('audio') || ruta.includes('voice');
    }

    isVideo(ruta: string | null | undefined, mensaje?: string | null): boolean {
        if (mensaje && mensaje.includes('[Archivo Multimedia: video]')) return true;
        if (!ruta) return false;
        return /\.(mp4|mov|webm|avi)$/i.test(ruta) || ruta.includes('video');
    }

    // --- User Management Logic ---

    toggleView() {
        this.currentView = this.currentView === 'dashboard' ? 'users' : 'dashboard';
        if (this.currentView === 'users' && this.usuarios.length === 0) {
            this.loadUsers();
            this.loadEmpresas();
        }
    }

    loadUsers() {
        this.userService.getUsers().subscribe({
            next: (data) => {
                this.usuarios = data;
                this.cdr.detectChanges();
            },
            error: (err) => console.error("Error loading users", err)
        });
    }

    loadEmpresas() {
        this.userService.getEmpresas().subscribe({
            next: (data) => {
                this.empresas = data;
                this.cdr.detectChanges();
            },
            error: (err) => console.error("Error loading empresas", err)
        });
    }

    openUserModal(user?: any) {
        if (user) {
            this.editingUserId = user.id;
            this.userForm = {
                nombre: user.nombre,
                usuario: user.usuario,
                password: '',
                tipo: user.tipo,
                id_empresa: user.id_empresa
            };
        } else {
            this.editingUserId = null;
            this.userForm = {
                nombre: '',
                usuario: '',
                password: '',
                tipo: 'vendedor',
                id_empresa: this.empresas.length > 0 ? this.empresas[0].id : null
            };
        }
        this.showUserModal = true;
    }

    closeUserModal() {
        this.showUserModal = false;
        this.editingUserId = null;
    }

    saveUser() {
        if (this.editingUserId) {
            this.userService.updateUser(this.editingUserId, this.userForm).subscribe({
                next: () => {
                    this.loadUsers();
                    this.closeUserModal();
                },
                error: (err) => console.error("Error updating user", err)
            });
        } else {
            this.userService.createUser(this.userForm).subscribe({
                next: () => {
                    this.loadUsers();
                    this.closeUserModal();
                },
                error: (err) => console.error("Error creating user", err)
            });
        }
    }

    logout() {
        this.authService.logout();
    }
}
