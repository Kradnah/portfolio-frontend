import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { ApiSession } from '../api-session';
import { I18n } from '../i18n';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  /** Respuesta escrita de antemano (preguntas sugeridas): no se envía al modelo. */
  canned?: boolean;
  error?: boolean;
}

const MAX_CHARS = 500;
const MAX_TURNS = 10;

@Component({
  selector: 'app-ask-ai',
  standalone: true,
  templateUrl: './ask-ai.component.html',
  styleUrl: './ask-ai.component.css',
})
export class AskAiComponent {
  /** Textos, preguntas sugeridas (respuesta fija: no gastan saldo de IA) y errores, en el idioma activo. */
  private readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;
  protected readonly maxChars = MAX_CHARS;
  protected readonly messages = signal<Message[]>([]);
  protected readonly draft = signal('');
  protected readonly busy = signal(false);
  protected readonly turns = signal(0);
  protected readonly maxTurns = MAX_TURNS;

  private readonly log = viewChild<ElementRef<HTMLElement>>('log');
  private readonly api = inject(ApiSession);

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
        const errors = this.t().chat.errors;
        this.fail(errors[detail ?? 'default'] ?? errors['default']);
        return;
      }
      this.turns.update((n) => n + 1);
      await this.readStream(res);
    } catch {
      this.fail(this.t().chat.errors['default']);
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

  private post(messages: { role: string; content: string }[]): Promise<Response> {
    return this.api.fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, lang: this.i18n.lang() }),
    });
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
        if (event.error) return this.fail(this.t().chat.errors['default']);
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
