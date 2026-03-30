import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { DashboardService, DashboardReporteConsolidado } from '../services/dashboard.service';
import { ChatService, Conversation, Message } from '../services/chat.service';
import { UserService } from '../services/user.service';
import { Subscription } from 'rxjs';
import { ClientesService } from '../services/clientes.service';
import { CryptoService } from '../services/crypto.service';
import { LucideAngularModule, LayoutDashboard, Users, Settings, LogOut, KeyRound, Sun, Moon, MessageCircle, Facebook, Instagram, Phone, X, Paperclip, Send, Menu, ChevronsLeft, ChevronsRight, ArrowLeft, CheckCircle, XCircle, AlertTriangle, Info, Edit, Save, Loader, Smile } from 'lucide-angular';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, FormsModule, LucideAngularModule],
    templateUrl: './home.component.html',
    styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy {
    authService = inject(AuthService);
    dashboardService = inject(DashboardService);
    chatService = inject(ChatService);
    userService = inject(UserService);
    clientesService = inject(ClientesService);
    cryptoService = inject(CryptoService);
    private cdr = inject(ChangeDetectorRef);

    // User Roles and Views
    userTipo: string = 'vendedor';
    currentView: 'dashboard' | 'chat' | 'users' | 'clientes' = 'dashboard';

    // UI State
    isDarkMode: boolean = false;
    isMobileMenuOpen: boolean = false;
    isSidebarCollapsed: boolean = false;
    isMobileSidebarOpen: boolean = false;
    showMobileConversationList: boolean = true;

    // Toast notifications
    toasts: { id: number; message: string; type: 'success' | 'error' | 'warning' }[] = [];
    private toastCounter = 0;

    showToast(message: string, type: 'success' | 'error' | 'warning' = 'success', duration = 4000) {
        const id = ++this.toastCounter;
        this.toasts.push({ id, message, type });
        this.cdr.detectChanges();
        setTimeout(() => this.dismissToast(id), duration);
    }

    dismissToast(id: number) {
        this.toasts = this.toasts.filter(t => t.id !== id);
        this.cdr.detectChanges();
    }

    get isCollapsed(): boolean {
        return this.isSidebarCollapsed && !this.isMobileSidebarOpen;
    }

    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        if (this.isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }

    toggleMobileMenu() {
        this.isMobileMenuOpen = !this.isMobileMenuOpen;
    }

    toggleSidebar() {
        if (this.isMobileSidebarOpen) {
            this.isMobileSidebarOpen = false;
        } else {
            this.isSidebarCollapsed = !this.isSidebarCollapsed;
            localStorage.setItem('sidebarCollapsed', this.isSidebarCollapsed.toString());
        }
        this.cdr.detectChanges();
    }

    toggleMobileSidebar() {
        this.isMobileSidebarOpen = !this.isMobileSidebarOpen;
    }

    closeMobileSidebar() {
        this.isMobileSidebarOpen = false;
    }

    backToConversationList() {
        this.showMobileConversationList = true;
        this.selectedConversation = null;
    }

    // User management data
    usuarios: any[] = [];
    empresas: any[] = [];
    showUserModal: boolean = false;
    showPasswordModal: boolean = false;
    newAdminPassword: string = '';
    
    editingUserId: number | null = null;
    userForm: any = {
        nombre: '',
        usuario: '',
        password: '',
        tipo: 'vendedor',
        id_empresa: null
    };

    // Clientes management
    clientes: any[] = [];
    showClienteModal: boolean = false;
    editingClienteId: number | null = null;
    clienteForm: any = {
        nombre_empresa: '',
        responsable: '',
        id_meta: '',
        fb_id: '',
        ig_id: '',
        id_tiktok: '',
        id_openAI: '',
        prompt_id: '',
        numero_celular: '',
        estado: 1,
        notificaciones: []
    };
    visibleFields: { [key: string]: boolean } = {};

    toggleVisibility(field: string) {
        this.visibleFields[field] = !this.visibleFields[field];
    }

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
    sessionExpiredSubscription: Subscription | null = null;
    refreshInterval: any;
    newMessageText: string = '';
    isSending: boolean = false;
    selectedFile: File | null = null;

    // User Info Panel
    showUserInfoPanel: boolean = false;
    isEditingUserInfo: boolean = false;
    isSavingUserInfo: boolean = false;
    userInfoData: { user_name: string; data_recordar: any } = { user_name: '', data_recordar: {} };
    editUserName: string = '';
    editDataRecordar: { interes: string; objetivo: string; ubicacion: string; notas: string } = { interes: '', objetivo: '', ubicacion: '', notas: '' };

    // Emoji Picker
    showEmojiPicker: boolean = false;
    activeEmojiCategory: string = 'caritas';
    emojiCategories = [
        { key: 'caritas', label: 'Caritas', icon: '😀' },
        { key: 'manos', label: 'Manos', icon: '👋' },
        { key: 'corazones', label: 'Corazones', icon: '❤️' },
        { key: 'animales', label: 'Animales', icon: '🐶' },
        { key: 'comida', label: 'Comida', icon: '🍕' },
        { key: 'viajes', label: 'Viajes', icon: '✈️' },
        { key: 'objetos', label: 'Objetos', icon: '💡' },
        { key: 'simbolos', label: 'Símbolos', icon: '✅' }
    ];
    emojiMap: { [key: string]: string[] } = {
        caritas: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','😮‍💨','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
        manos: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','👀','👁️','👅','👄'],
        corazones: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','🫶','💏','💑','❤️‍🔥','❤️‍🩹'],
        animales: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰','🪲','🪳','🦟','🦗','🐢','🐍','🦎','🦂','🦀','🦞','🦐','🦑','🐙','🐠','🐟','🐡','🐬','🦈','🐳','🐋','🐊','🐆','🐅','🐃','🐂','🐄','🦌','🐪','🐫','🦙','🦒','🐘','🦣','🦏','🦛','🐿️','🦫','🦔','🐇','🐁','🐀','🐈','🐩','🐕','🦮'],
        comida: ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🦴','🌭','🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🥛','🍼','☕','🫖','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🫗'],
        viajes: ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🛵','🏍️','🛺','🚲','🛴','🚍','🚘','🚖','✈️','🛩️','🛫','🛬','🪂','💺','🚀','🛸','🚁','🛶','⛵','🚤','🛥️','🛳️','⛴️','🚢','🗼','🏰','🏯','🏟️','🎡','🎢','🎠','⛲','⛱️','🏖️','🏝️','🏜️','🌋','⛰️','🏔️','🗻','🏕️','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🗽','⛪','🕌','🛕','🕍','⛩️','🕋'],
        objetos: ['💡','🔦','🕯️','📱','💻','⌨️','🖥️','🖨️','🖱️','🖲️','💾','💿','📀','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🎙️','🎚️','🎛️','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🪫','🔌','💰','🪙','💴','💵','💶','💷','💸','💳','🧾','✉️','📧','📨','📩','📮','📪','📫','📬','📭','📦','📝','📄','📃','📑','📊','📈','📉','🗒️','🗓️','📆','📅','🗑️','📁','📂','🗂️','🗃️','🗳️','🔒','🔓','🔑','🗝️'],
        simbolos: ['✅','❌','❓','❗','‼️','⁉️','💯','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔺','🔻','🔸','🔹','🔶','🔷','💠','🔘','🔲','🔳','⬛','⬜','◾','◽','▪️','▫️','🏁','🚩','🏴','🏳️','🏳️‍🌈','⚠️','♻️','🔰','💮','🔱','⭐','🌟','💫','✨','⚡','🔥','💥','❄️','🌊','🎵','🎶','💤','🆗','🆕','🆙','🆒','🆓','🆔','ℹ️','🈳','🔣','🔤','🔡','🔠','🔢','#️⃣','*️⃣','0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🏧','🚮','🚰','♿','🚹','🚺','🚻','🚼','🛗']
    };

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

        // Initialize Sidebar state from localStorage
        if (localStorage.getItem('sidebarCollapsed') === 'true') {
            this.isSidebarCollapsed = true;
        }

        // Initialize Theme from localStorage
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            this.isDarkMode = true;
            document.documentElement.classList.add('dark');
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

        // Suscribirse a sesión expirada
        this.sessionExpiredSubscription = this.authService.sessionExpired$.subscribe(msg => {
            this.showToast(msg, 'warning', 5000);
            setTimeout(() => this.authService.logout(), 5000);
        });

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
        if (this.sessionExpiredSubscription) {
            this.sessionExpiredSubscription.unsubscribe();
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
        this.showMobileConversationList = false;
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

        // Cargar datos del usuario
        this.loadUserData(conv.id);
    }

    loadUserData(convId: number) {
        this.showUserInfoPanel = false;
        this.isEditingUserInfo = false;
        this.chatService.getUserData(convId).subscribe({
            next: (data) => {
                this.userInfoData = {
                    user_name: data.user_name || '',
                    data_recordar: data.data_recordar || {}
                };
                this.cdr.detectChanges();
            },
            error: (err) => console.error('Error loading user data', err)
        });
    }

    toggleUserInfoPanel() {
        this.showUserInfoPanel = !this.showUserInfoPanel;
        if (this.showUserInfoPanel) {
            this.isEditingUserInfo = false;
        }
    }

    startEditingUserInfo() {
        this.isEditingUserInfo = true;
        this.editUserName = this.userInfoData.user_name;
        const dr = this.userInfoData.data_recordar || {};
        this.editDataRecordar = {
            interes: dr.interes || '',
            objetivo: dr.objetivo || '',
            ubicacion: dr.ubicacion || '',
            notas: dr.notas || ''
        };
    }

    cancelEditingUserInfo() {
        this.isEditingUserInfo = false;
    }

    saveUserInfo() {
        if (!this.selectedConversation || this.isSavingUserInfo) return;
        this.isSavingUserInfo = true;
        const payload = {
            user_name: this.editUserName.trim(),
            data_recordar: { ...this.userInfoData.data_recordar, ...this.editDataRecordar }
        };
        this.chatService.updateUserData(this.selectedConversation.id, payload).subscribe({
            next: () => {
                this.userInfoData.user_name = payload.user_name;
                this.userInfoData.data_recordar = payload.data_recordar;
                this.isEditingUserInfo = false;
                this.isSavingUserInfo = false;
                this.showToast('Información del usuario actualizada', 'success');
                this.loadConversations();
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error saving user data', err);
                this.isSavingUserInfo = false;
                this.showToast('Error al guardar la información', 'error');
                this.cdr.detectChanges();
            }
        });
    }

    getUserInfoEntries(): { key: string; value: string }[] {
        const dr = this.userInfoData.data_recordar || {};
        return Object.entries(dr)
            .filter(([_, v]) => v)
            .map(([k, v]) => ({ key: k, value: String(v) }));
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
        
        this.showEmojiPicker = false;
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

    toggleEmojiPicker() {
        this.showEmojiPicker = !this.showEmojiPicker;
    }

    insertEmoji(emoji: string) {
        this.newMessageText += emoji;
        this.cdr.detectChanges();
    }

    getActiveEmojis(): string[] {
        return this.emojiMap[this.activeEmojiCategory] || [];
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

    // --- View Management Logic ---

    setView(view: 'dashboard' | 'chat' | 'users' | 'clientes') {
        this.currentView = view;
        this.closeMobileSidebar();
        this.showMobileConversationList = true;
        if (view === 'users' && this.usuarios.length === 0) {
            this.loadUsers();
            this.loadEmpresas();
        } else if (view === 'clientes' && this.clientes.length === 0) {
            this.loadClientes();
        }
    }

    toggleView() {
        this.setView(this.currentView === 'dashboard' ? 'users' : 'dashboard');
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

    // --- Clientes Management Logic ---
    loadClientes() {
        this.clientesService.getClientes().subscribe({
            next: (data) => {
                this.clientes = data;
                this.cdr.detectChanges();
            },
            error: (err) => console.error("Error loading clientes", err)
        });
    }

    openClienteModal(cliente?: any) {
        this.visibleFields = {};
        if (cliente) {
            this.editingClienteId = cliente.id;
            let notif = cliente.notificaciones ? JSON.parse(JSON.stringify(cliente.notificaciones)) : [];
            notif = this.cryptoService.decryptNotifications(notif);
            this.clienteForm = {
                nombre_empresa: cliente.nombre_empresa,
                responsable: cliente.responsable || '',
                id_meta: this.cryptoService.decrypt(cliente.id_meta || ''),
                fb_id: cliente.fb_id || '',
                ig_id: cliente.ig_id || '',
                id_tiktok: this.cryptoService.decrypt(cliente.id_tiktok || ''),
                id_openAI: this.cryptoService.decrypt(cliente.id_openAI || ''),
                prompt_id: this.cryptoService.decrypt(cliente.prompt_id || ''),
                numero_celular: cliente.numero_celular || '',
                estado: cliente.estado,
                notificaciones: notif
            };
        } else {
            this.editingClienteId = null;
            this.clienteForm = {
                nombre_empresa: '',
                responsable: '',
                id_meta: '',
                fb_id: '',
                ig_id: '',
                id_tiktok: '',
                id_openAI: '',
                prompt_id: '',
                numero_celular: '',
                estado: 1,
                notificaciones: []
            };
        }
        this.showClienteModal = true;
    }

    closeClienteModal() {
        this.showClienteModal = false;
        this.editingClienteId = null;
    }

    addNotification() {
        if (!this.clienteForm.notificaciones) this.clienteForm.notificaciones = [];
        this.clienteForm.notificaciones.push({ correo: '', nombre: '', telefono: '', descripcion: '' });
    }

    removeNotification(index: number) {
        this.clienteForm.notificaciones.splice(index, 1);
    }

    saveCliente() {
        const dataToSave = { ...this.clienteForm };
        dataToSave.notificaciones = this.cryptoService.encryptNotifications(dataToSave.notificaciones);
        // Encriptar solo campos sensibles que NO se usan como claves de relación en vistas SQL
        // NO encriptar: numero_celular, fb_id, ig_id (se usan en JOINs de vistas del dashboard)
        const sensitiveFields = ['id_meta', 'id_tiktok', 'id_openAI', 'prompt_id'];
        for (const field of sensitiveFields) {
            if (dataToSave[field]) {
                dataToSave[field] = this.cryptoService.encrypt(dataToSave[field]);
            }
        }
        if (this.editingClienteId) {
            this.clientesService.updateCliente(this.editingClienteId, dataToSave).subscribe({
                next: () => {
                    this.loadClientes();
                    this.closeClienteModal();
                },
                error: (err) => console.error("Error updating cliente", err)
            });
        } else {
            this.clientesService.createCliente(dataToSave).subscribe({
                next: () => {
                    this.loadClientes();
                    this.closeClienteModal();
                },
                error: (err) => console.error("Error creating cliente", err)
            });
        }
    }

    // --- Admin Password Change Logic ---
    openPasswordModal() {
        this.newAdminPassword = '';
        this.showPasswordModal = true;
    }

    closePasswordModal() {
        this.showPasswordModal = false;
    }

    saveAdminPassword() {
        if (!this.newAdminPassword.trim()) return;
        const userInfo = this.authService.getCurrentUser();
        if (userInfo && userInfo.sub) {
            this.userService.updateUser(userInfo.sub, { password: this.newAdminPassword }).subscribe({
                next: () => {
                    this.closePasswordModal();
                    this.showToast('Contraseña actualizada. Cerrando sesión...', 'success', 3000);
                    setTimeout(() => this.logout(), 3000);
                },
                error: (err) => {
                    console.error("Error updating password", err);
                    this.showToast('Error al actualizar la contraseña', 'error');
                }
            });
        }
    }

    logout() {
        this.authService.logout();
    }
}
