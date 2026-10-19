import { Component, inject } from '@angular/core';
import { Dict, I18n } from '../i18n';

interface StackGroup {
  key: keyof Dict['stack']['groups'];
  tone: 'lime' | 'pink' | 'blue' | 'yellow';
  items: string[];
}

/** Resumen del stack (fuente: api/knowledge/profile.md). */
const GROUPS: StackGroup[] = [
  { key: 'backend', tone: 'lime', items: ['Python', 'FastAPI', 'NestJS', 'REST', 'WebSockets/SSE', 'Celery'] },
  { key: 'data', tone: 'blue', items: ['PostgreSQL', 'PostGIS', 'MySQL', 'Redis'] },
  { key: 'frontend', tone: 'pink', items: ['Angular', 'React', 'React Native', 'TypeScript'] },
  { key: 'ai', tone: 'yellow', items: ['LLMs', 'RAG', 'LangGraph', 'MCP', 'WhisperX', 'vLLM', '@agents'] },
  { key: 'devops', tone: 'lime', items: ['Docker', 'GitLab CI', 'GitHub Actions', 'GCP', 'AWS', 'Dokploy'] },
  { key: 'automation', tone: 'blue', items: ['Selenium', 'Playwright', 'Pandas', 'UiPath'] },
];

/** Índice global de cada chip, para escalonar la aparición y el barrido. */
let n = 0;
const ROWS = GROUPS.map((g, row) => ({ ...g, row, chips: g.items.map((label) => ({ label, i: n++ })) }));
const TOTAL = n;

@Component({
  selector: 'app-stack-card',
  standalone: true,
  template: `
    <div class="win saas-card">
      <div class="bar">
        <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        <span class="title">~/julian/stack.yml</span>
      </div>
      <div class="body" [style.--total]="total">
        <p class="cmd"><span class="prompt">$</span> <span class="typed">cat stack.yml</span></p>
        @for (g of rows; track g.key) {
          <div class="row" [style.--row]="g.row">
            <span class="key">{{ t().stack.groups[g.key] }}:</span>
            <ul class="chips">
              @for (c of g.chips; track c.label) {
                <li class="chip" [class]="'tone-' + g.tone" [style.--i]="c.i">{{ c.label === '@agents' ? t().stack.agents : c.label }}</li>
              }
            </ul>
          </div>
        }
        <p class="foot"><span class="prompt">&gt;</span> {{ t().stack.foot }}<span class="caret"></span></p>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .win { background: #fff; }
    .bar { display: flex; align-items: center; gap: 6px; padding: 9px 14px; background: #000; color: #fff; }
    .dot { width: 11px; height: 11px; border-radius: 50%; background: var(--pink); }
    .dot:nth-child(2) { background: var(--yellow); }
    .dot:nth-child(3) { background: var(--lime); }
    .title { margin-left: 8px; font-family: 'Courier New', Courier, monospace; font-weight: 700; font-size: 13px; }

    .body { padding: 16px 18px 18px; display: grid; gap: 12px; font-family: 'Courier New', Courier, monospace; }
    .cmd, .foot { margin: 0; font-size: 13px; font-weight: 700; }
    .prompt { color: var(--pink); margin-right: 1ch; }
    .typed { display: inline-block; overflow: hidden; white-space: nowrap; vertical-align: bottom; animation: type 0.8s 1.3s steps(13) both; }

    .row { display: grid; grid-template-columns: 9.5em 1fr; align-items: start; gap: 8px; animation: row-in 0.4s both; animation-delay: calc(2.1s + var(--row) * 0.15s); }
    .key { font-size: 13px; font-weight: 700; padding-top: 4px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; margin: 0; padding: 0; }
    .chip {
      border: 2px solid #000; padding: 2px 8px; font-family: system-ui, sans-serif; font-size: 12px; font-weight: 800;
      box-shadow: 2px 2px 0 #000; cursor: default;
      transition: translate 0.12s, box-shadow 0.12s;
      animation: chip-in 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.5) both, sweep calc(var(--total) * 0.3s) linear infinite;
      animation-delay: calc(2.2s + var(--i) * 0.05s), calc(4s + var(--i) * 0.3s);
    }
    .chip:hover { translate: -2px -2px; box-shadow: 4px 4px 0 #000; }
    .chip { background: var(--bg); color: var(--fg); }
    .tone-lime { --bg: var(--lime); --fg: #000; }
    .tone-pink { --bg: var(--pink); --fg: #fff; }
    .tone-blue { --bg: var(--blue); --fg: #fff; }
    .tone-yellow { --bg: var(--yellow); --fg: #000; }

    .foot { animation: row-in 0.4s 3.4s both; }
    .caret { display: inline-block; width: 8px; height: 14px; margin-left: 4px; vertical-align: -2px; background: #000; animation: blink 1s steps(1) infinite; }

    @keyframes type { from { width: 0; } to { width: 13ch; } }
    @keyframes row-in { from { opacity: 0; translate: -16px 0; } }
    @keyframes chip-in { from { opacity: 0; scale: 0.4; } }
    /* Un chip a la vez se invierte a negro: el barrido recorre todo el stack en bucle. */
    @keyframes sweep {
      0%, 3% { background: #000; color: var(--lime); }
      6%, 100% { background: var(--bg); color: var(--fg); }
    }
    @keyframes blink { 50% { opacity: 0; } }

    @media (prefers-reduced-motion: reduce) {
      .typed, .row, .chip, .foot, .caret { animation: none; }
    }
  `,
})
export class StackCardComponent {
  protected readonly t = inject(I18n).t;
  protected readonly rows = ROWS;
  protected readonly total = TOTAL;
}
