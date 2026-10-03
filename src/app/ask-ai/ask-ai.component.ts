import { Component, ElementRef, signal, viewChild } from '@angular/core';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  /** Respuesta escrita de antemano (preguntas sugeridas): no se envía al modelo. */
  canned?: boolean;
  error?: boolean;
}

const MAX_CHARS = 500;
const MAX_TURNS = 10;

/** Preguntas frecuentes con respuesta fija: no gastan saldo de IA. */
const SUGGESTED: { label: string; q: string; a: string }[] = [
  {
    label: 'Su stack',
    q: '¿Qué stack domina?',
    a: 'Backend con Python y FastAPI (también Node.js/NestJS), APIs REST con JWT/OAuth2, PostgreSQL (su base de datos fuerte), MySQL y Redis. En frontend trabaja con Angular y React. Despliega con Docker en AWS, GCP y en su propio VPS con Dokploy.',
  },
  {
    label: 'Mayor logro',
    q: '¿Cuál es su logro más destacado?',
    a: 'En GroupCOS diseñó una solución de QA de llamadas con WhisperX desplegado en servidores propios e integrado con ChatGPT. Ahorra USD 4.000 al mes en APIs externas y se convirtió en un producto que la empresa vende a nuevos clientes.',
  },
  {
    label: '¿Sabe de IA?',
    q: '¿Tiene experiencia con IA?',
    a: 'Sí: bots de WhatsApp y agentes de IA con APIs de OpenAI, modelos de HuggingFace adaptados al negocio, speech-to-text con WhisperX y automatizaciones con Python, Selenium y Playwright. Este mismo asistente es una API suya en FastAPI.',
  },
  {
    label: 'Contacto',
    q: '¿Cómo lo contacto?',
    a: 'Por email a kradnah@gmail.com o por LinkedIn (linkedin.com/in/julian-lizcano). También puedes descargar su CV en la sección de contacto.',
  },
];

const ERRORS: Record<string, string> = {
  ip_burst: 'Vas muy rápido 😅 Espera unos minutos y vuelve a preguntar.',
  ip_daily: 'Llegaste al límite de preguntas de hoy. ¡Gracias por el interés! Escríbeme a kradnah@gmail.com.',
  global_daily: 'El asistente ya respondió mucho hoy. Escríbeme a kradnah@gmail.com y te contesto yo.',
  max_turns: 'Esta conversación llegó a su límite. Si quieres saber más, escríbeme a kradnah@gmail.com.',
  default: 'No pude responder ahora mismo. Inténtalo más tarde o escríbeme a kradnah@gmail.com.',
};

@Component({
  selector: 'app-ask-ai',
  standalone: true,
  templateUrl: './ask-ai.component.html',
  styleUrl: './ask-ai.component.css',
})
export class AskAiComponent {
  protected readonly suggested = SUGGESTED;
  protected readonly maxChars = MAX_CHARS;
  protected readonly messages = signal<Message[]>([]);
  protected readonly draft = signal('');
  protected readonly busy = signal(false);
  protected readonly turns = signal(0);
  protected readonly maxTurns = MAX_TURNS;

  private readonly log = viewChild<ElementRef<HTMLElement>>('log');
  private session: string | null = null;

  protected askSuggested(item: { q: string; a: string }): void {
    if (this.busy()) return;
    this.push({ role: 'user', content: item.q, canned: true }, { role: 'assistant', content: item.a, canned: true });
  }

  protected onInput(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value.slice(0, MAX_CHARS));
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.send();
    }
  }

  protected async send(): Promise<void> {
    const text = this.draft().trim();
    if (!text || this.busy() || this.turns() >= MAX_TURNS) return;
    this.draft.set('');
    this.busy.set(true);
    this.push({ role: 'user', content: text }, { role: 'assistant', content: '' });

    try {
      const res = await this.post(this.history());
      if (!res.ok) {
        const detail = res.status === 429 ? ((await res.json()) as { detail?: string }).detail : undefined;
        this.fail(ERRORS[detail ?? 'default'] ?? ERRORS['default']);
        return;
      }
      this.turns.update((n) => n + 1);
      await this.readStream(res);
    } catch {
      this.fail(ERRORS['default']);
    } finally {
      this.busy.set(false);
    }
  }

  /** Mensajes reales de la conversación (sin las respuestas fijas ni la respuesta en curso). */
  private history(): { role: string; content: string }[] {
    return this.messages()
      .filter((m) => !m.canned && !m.error && m.content)
      .map(({ role, content }) => ({ role, content }));
  }

  private async post(messages: { role: string; content: string }[]): Promise<Response> {
    const call = async () => {
      this.session ??= await this.createSession();
      return fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.session}` },
        body: JSON.stringify({ messages }),
      });
    };
    let res = await call();
    if (res.status === 401) {
      // Sesión caducada: se pide otra una sola vez.
      this.session = null;
      res = await call();
    }
    return res;
  }

  private async createSession(): Promise<string> {
    const res = await fetch('/api/chat/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) throw new Error('session');
    return ((await res.json()) as { token: string }).token;
  }

  private async readStream(res: Response): Promise<void> {
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const raw of events) {
        if (!raw.startsWith('data: ')) continue;
        const event = JSON.parse(raw.slice(6)) as { delta?: string; error?: string };
        if (event.error) return this.fail(ERRORS['default']);
        if (event.delta) this.appendToLast(event.delta);
      }
    }
  }

  private push(...items: Message[]): void {
    this.messages.update((list) => [...list, ...items]);
    this.scroll();
  }

  private appendToLast(delta: string): void {
    this.messages.update((list) => {
      const last = list[list.length - 1];
      return [...list.slice(0, -1), { ...last, content: last.content + delta }];
    });
    this.scroll();
  }

  private fail(text: string): void {
    this.messages.update((list) => [...list.slice(0, -1), { role: 'assistant', content: text, error: true }]);
    this.scroll();
  }

  private scroll(): void {
    queueMicrotask(() => {
      const el = this.log()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
