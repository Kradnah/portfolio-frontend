import { Injectable } from '@angular/core';

/** Token de sesión de la API (HMAC). Lo comparten el chat y las demos; se pide una sola vez. */
@Injectable({ providedIn: 'root' })
export class ApiSession {
  private token: Promise<string> | null = null;

  get(): Promise<string> {
    this.token ??= fetch('/api/chat/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }).then(async (res) => {
      if (!res.ok) throw new Error('session');
      return ((await res.json()) as { token: string }).token;
    });
    this.token.catch(() => (this.token = null));
    return this.token;
  }

  /** Tras un 401 (sesión caducada): la próxima llamada pide otra. */
  reset(): void {
    this.token = null;
  }

  /** fetch con `Authorization` y un reintento si la sesión caducó. */
  async fetch(url: string, init: RequestInit = {}): Promise<Response> {
    const call = async () =>
      fetch(url, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...init.headers, Authorization: `Bearer ${await this.get()}` },
      });
    let res = await call();
    if (res.status === 401) {
      this.reset();
      res = await call();
    }
    return res;
  }
}
