import { Injectable, computed, effect, signal } from '@angular/core';

export type Lang = 'es' | 'en';

const STORAGE_KEY = 'lang';

const ES = {
  nav: {
    projects: 'Proyectos',
    ai: 'Pregúntale a mi IA',
    contact: 'Contacto',
    cv: 'Descargar CV',
    switchTo: 'Ver en inglés',
  },
  hero: {
    body: [
      'Construyo APIs, apps y automatizaciones',
      'con IA que llegan a producción.',
      'Python · FastAPI · NestJS · Angular · React',
    ],
    cta: 'Ver proyectos',
    marqueeA: ['Python', 'FastAPI', 'NestJS', 'Angular', 'React', 'PostgreSQL', 'Redis', 'Docker', 'IA en producción'],
    marqueeB: ['APIs', 'Apps', 'Automatizaciones', 'Agentes de IA', 'Despliegue propio', 'Bogotá · Colombia'],
  },
  meme: {
    alt: 'Foto del meme «literally me»',
    top: 'this is literally me',
    bottom: '(es un meme, ojalá lo captes)',
  },
  stack: {
    groups: {
      backend: 'backend',
      data: 'datos',
      frontend: 'frontend',
      ai: 'ia',
      devops: 'devops',
      automation: 'automatización',
    },
    agents: 'Agentes',
    foot: '4+ años llevando código a producción',
  },
  chat: {
    title: 'pregúntale a mi IA',
    counter: 'Preguntas usadas en esta conversación',
    hello: '¡Hola! 👋',
    intro: 'Soy un asistente que conoce la experiencia, el stack y los proyectos de Julian.',
    askMe: 'Pregúntame en español o inglés ↓',
    placeholder: 'Ej.: ¿Ha trabajado con microservicios?',
    inputLabel: 'Tu pregunta',
    send: 'Enviar',
    fineprint: 'Respuestas generadas con IA a partir de mi CV; pueden contener errores.',
    suggested: [
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
    ],
    errors: {
      ip_burst: 'Vas muy rápido 😅 Espera unos minutos y vuelve a preguntar.',
      ip_daily: 'Llegaste al límite de preguntas de hoy. ¡Gracias por el interés! Escríbeme a kradnah@gmail.com.',
      global_daily: 'El asistente ya respondió mucho hoy. Escríbeme a kradnah@gmail.com y te contesto yo.',
      max_turns: 'Esta conversación llegó a su límite. Si quieres saber más, escríbeme a kradnah@gmail.com.',
      default: 'No pude responder ahora mismo. Inténtalo más tarde o escríbeme a kradnah@gmail.com.',
    } as Record<string, string>,
  },
  projects: {
    kicker: '01 · Proyectos',
    title: 'Cosas que ya están',
    titleHl: 'en producción',
    sub: 'Construidos y desplegados por mí, en mi propio servidor.',
    live: 'En producción',
    ownBusiness: 'Mi propio negocio',
    casazhefAlt: 'Página de inicio de casazhef.com',
    casazhefDesc:
      'La web de mi cocina oculta de fines de semana en Girardot: menú por categorías, horarios, ubicación y pedidos por WhatsApp. Del diseño al despliegue, hecha por mí.',
    viewLive: 'Ver en vivo ↗',
    demo: 'Demo funcional',
    rideTabs: 'Pantallas del panel de rideapp',
    rideShots: [
      { label: 'Dashboard', alt: 'Panel de rideapp: métricas del día y mapa de conductores en línea' },
      { label: 'Viajes', alt: 'Panel de rideapp: lista de viajes con estado y precio' },
      { label: 'Tarifas', alt: 'Panel de rideapp: tarifas versionadas por categoría' },
    ],
    rideDesc:
      'App de movilidad tipo Uber para Girardot, Ricaurte y Flandes: app de pasajero, app de conductor y panel de administración (en las capturas), con viajes en tiempo real.',
    ridePoints: [
      'Emparejamiento en vivo con Redis GEO, Socket.IO y una máquina de estados de viaje.',
      'Seguridad: Argon2id, JWT ES256 con refresh rotativo, 2FA en el panel y Ley 1581.',
      'Monorepo con contratos Zod compartidos y tests de integración con Testcontainers.',
    ],
    apk: { pasajero: 'pasajero', conductor: 'conductor' } as Record<string, string>,
  },
  contact: {
    kicker: '02 · Contacto',
    title: '¿Hablamos?',
    titleHl: 'Estoy a un mensaje',
    sub: 'Desarrollador Full-Stack en Bogotá, Colombia. Español e inglés.',
    cv: 'Descargar CV (PDF)',
    footer: 'Hecho con Angular y FastAPI en mi propio servidor.',
  },
};

export type Dict = typeof ES;

const EN: Dict = {
  nav: {
    projects: 'Projects',
    ai: 'Ask my AI',
    contact: 'Contact',
    cv: 'Download CV',
    switchTo: 'Ver en español',
  },
  hero: {
    body: [
      'I build APIs, apps and AI-powered',
      'automations that ship to production.',
      'Python · FastAPI · NestJS · Angular · React',
    ],
    cta: 'See projects',
    marqueeA: ['Python', 'FastAPI', 'NestJS', 'Angular', 'React', 'PostgreSQL', 'Redis', 'Docker', 'AI in production'],
    marqueeB: ['APIs', 'Apps', 'Automations', 'AI agents', 'Self-hosted deploys', 'Bogotá · Colombia'],
  },
  meme: {
    alt: '"Literally me" meme photo',
    top: 'this is literally me',
    bottom: "(it's a meme, hope you get it)",
  },
  stack: {
    groups: {
      backend: 'backend',
      data: 'data',
      frontend: 'frontend',
      ai: 'ai',
      devops: 'devops',
      automation: 'automation',
    },
    agents: 'Agents',
    foot: '4+ years shipping code to production',
  },
  chat: {
    title: 'ask my AI',
    counter: 'Questions used in this conversation',
    hello: 'Hi there! 👋',
    intro: "I'm an assistant that knows Julian's experience, stack and projects.",
    askMe: 'Ask me in English or Spanish ↓',
    placeholder: 'E.g.: Has he worked with microservices?',
    inputLabel: 'Your question',
    send: 'Send',
    fineprint: 'AI-generated answers based on my CV; they may contain mistakes.',
    suggested: [
      {
        label: 'His stack',
        q: 'What is his main stack?',
        a: 'Backend with Python and FastAPI (also Node.js/NestJS), REST APIs with JWT/OAuth2, PostgreSQL (his strongest database), MySQL and Redis. On the frontend he works with Angular and React. He deploys with Docker on AWS, GCP and his own VPS running Dokploy.',
      },
      {
        label: 'Top achievement',
        q: 'What is his most notable achievement?',
        a: 'At GroupCOS he designed a call QA solution with WhisperX running on in-house servers and integrated with ChatGPT. It saves USD 4,000 a month in external APIs and became a product the company sells to new clients.',
      },
      {
        label: 'AI experience?',
        q: 'Does he have AI experience?',
        a: 'Yes: WhatsApp bots and AI agents built on the OpenAI APIs, HuggingFace models adapted to the business, speech-to-text with WhisperX, and automations with Python, Selenium and Playwright. This very assistant is one of his FastAPI APIs.',
      },
      {
        label: 'Contact',
        q: 'How can I reach him?',
        a: 'By email at kradnah@gmail.com or on LinkedIn (linkedin.com/in/julian-lizcano). You can also download his CV in the contact section.',
      },
    ],
    errors: {
      ip_burst: "You're going too fast 😅 Wait a few minutes and ask again.",
      ip_daily: "You've reached today's question limit. Thanks for your interest! Write to me at kradnah@gmail.com.",
      global_daily: 'The assistant has answered a lot today. Write to me at kradnah@gmail.com and I will reply myself.',
      max_turns: 'This conversation has reached its limit. To learn more, write to me at kradnah@gmail.com.',
      default: "I couldn't answer right now. Try again later or write to me at kradnah@gmail.com.",
    },
  },
  projects: {
    kicker: '01 · Projects',
    title: 'Things already',
    titleHl: 'in production',
    sub: 'Built and deployed by me, on my own server.',
    live: 'In production',
    ownBusiness: 'My own business',
    casazhefAlt: 'casazhef.com home page',
    casazhefDesc:
      'The website of my weekend ghost kitchen in Girardot: menu by category, opening hours, location and WhatsApp orders. Designed, built and deployed by me.',
    viewLive: 'See it live ↗',
    demo: 'Working demo',
    rideTabs: 'rideapp admin panel screens',
    rideShots: [
      { label: 'Dashboard', alt: "rideapp admin: today's metrics and a map of online drivers" },
      { label: 'Trips', alt: 'rideapp admin: trip list with status and price' },
      { label: 'Fares', alt: 'rideapp admin: versioned fares per category' },
    ],
    rideDesc:
      'An Uber-style ride-hailing app for Girardot, Ricaurte and Flandes (Colombia): rider app, driver app and an admin panel (in the screenshots), with real-time trips.',
    ridePoints: [
      'Live matching with Redis GEO, Socket.IO and a trip state machine.',
      'Security: Argon2id, ES256 JWTs with rotating refresh tokens, 2FA on the panel and Colombian data-protection law (Ley 1581).',
      'Monorepo with shared Zod contracts and integration tests with Testcontainers.',
    ],
    apk: { pasajero: 'rider', conductor: 'driver' },
  },
  contact: {
    kicker: '02 · Contact',
    title: "Let's talk?",
    titleHl: "I'm one message away",
    sub: 'Full-Stack Developer in Bogotá, Colombia. Spanish and English.',
    cv: 'Download CV (PDF, Spanish)',
    footer: 'Built with Angular and FastAPI on my own server.',
  },
};

const DICTS: Record<Lang, Dict> = { es: ES, en: EN };

/** Idioma guardado (si el visitante lo cambió a mano) o el preferido del navegador; por defecto inglés. */
function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'es' || saved === 'en') return saved;
  } catch {
    // Sin acceso a localStorage: se usa la preferencia del navegador.
  }
  const prefs = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
  for (const tag of prefs) {
    const base = tag?.toLowerCase().split('-')[0];
    if (base === 'es' || base === 'en') return base;
  }
  return 'en';
}

@Injectable({ providedIn: 'root' })
export class I18n {
  readonly lang = signal<Lang>(initialLang());
  readonly t = computed(() => DICTS[this.lang()]);

  constructor() {
    effect(() => {
      if (typeof document !== 'undefined') document.documentElement.lang = this.lang();
    });
  }

  toggle(): void {
    const next: Lang = this.lang() === 'es' ? 'en' : 'es';
    this.lang.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Sin persistencia: el cambio vale solo para esta visita.
    }
  }
}
