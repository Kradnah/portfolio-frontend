import { Injectable, computed, effect, signal } from '@angular/core';

export type Lang = 'es' | 'en';

const STORAGE_KEY = 'lang';

const ES = {
  cvUrl: '/cv/Julian_Lizcano_CV.pdf',
  nav: {
    projects: 'Proyectos',
    ai: 'Pregúntale a mi IA',
    experience: 'Experiencia',
    contact: 'Contacto',
    available: 'Disponible para trabajar',
    cv: 'Descargar CV',
    switchTo: 'Ver en inglés',
  },
  hero: {
    body: [
      'Full-Stack AI Engineer: llevo LLMs,',
      'agentes y automatización a producción.',
      'Python · FastAPI · Angular · IA generativa',
    ],
    cta: 'Ver proyectos',
    marqueeA: ['Python', 'FastAPI', 'Angular', 'React', 'LLMs', 'RAG', 'LangGraph', 'PostgreSQL', 'Docker', 'IA en producción'],
    marqueeB: ['APIs', 'Agentes de IA', 'Speech-to-text', 'OCR', 'Automatizaciones', 'Despliegue propio', 'Colombia · remoto'],
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
    foot: 'casi 4 años llevando código a producción',
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
        a: 'Backend con Python y FastAPI (también Node.js/NestJS), APIs REST con JWT/OAuth2, PostgreSQL, MySQL y Redis. En frontend, Angular y React. En IA: LLMs (OpenAI, Claude, Gemini), RAG, agentes con LangChain/LangGraph y MCP. Despliega con Docker en GCP y en su propio VPS con Dokploy.',
      },
      {
        label: 'Mayor logro',
        q: '¿Cuál es su logro más destacado?',
        a: 'En GroupCOS diseñó una solución de análisis de llamadas con WhisperX en servidores propios e integrado con ChatGPT para evaluar asesores y generar feedback automático. Ahorra USD 4.000 al mes en APIs externas y se empaquetó como producto comercial para nuevos clientes.',
      },
      {
        label: '¿Sabe de IA?',
        q: '¿Tiene experiencia con IA?',
        a: 'Sí: bots de WhatsApp y agentes de IA con la API de OpenAI, OCR para validar facturas en PDF, speech-to-text con WhisperX, RAG y modelos de Hugging Face adaptados al negocio. También corre modelos locales (vLLM, llama.cpp, Ollama) y hace fine-tuning con LoRA. Este mismo asistente es una API suya en FastAPI.',
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
  experience: {
    kicker: '01 · Experiencia',
    title: 'Casi 4 años',
    titleHl: 'llevando IA a producción',
    sub: 'Automatización, IA generativa y desarrollo full-stack en empresas reales.',
    jobs: [
      {
        role: 'Automation Developer',
        company: 'GroupCOS',
        dates: 'Jul 2023 – Jul 2026',
        place: 'Bogotá · remoto',
        stat: { value: 'USD 4.000', label: 'ahorrados cada mes con el análisis de llamadas con IA' },
        points: [
          'Diseñé y desplegué un análisis de llamadas end-to-end: WhisperX en servidores propios + ChatGPT para evaluar asesores y dar feedback automático. Se empaquetó como producto comercial.',
          'Herramienta de OCR que valida facturas en PDF: extrae datos personales y valores y los verifica automáticamente.',
          'Bots de WhatsApp y agentes de IA con la API de OpenAI; modelos de Hugging Face adaptados al negocio.',
          'APIs con FastAPI y NestJS, frontends en Angular y React, despliegue con Docker en GCP y CI/CD en GitLab.',
          'Mentoría a desarrolladores junior y practicantes, trabajando bajo Scrum.',
        ],
        stack: ['Python', 'FastAPI', 'WhisperX', 'OpenAI', 'Angular', 'React', 'Docker', 'GCP'],
      },
      {
        role: 'RPA Developer',
        company: 'Net Applications',
        dates: 'Oct 2022 – Jul 2023',
        place: 'Bogotá',
        stat: null,
        points: [
          'Bots de RPA con UiPath y Automation Anywhere para automatizar procesos de clientes.',
          'Scripts en Python para flujos operativos y optimización de bases de datos MySQL.',
        ],
        stack: ['UiPath', 'Automation Anywhere', 'Python', 'MySQL'],
      },
      {
        role: 'Aprendiz de Análisis y Desarrollo de Sistemas',
        company: 'Siemens Energy',
        dates: 'Abr 2022 – Oct 2022',
        place: 'Bogotá',
        stat: null,
        points: ['Estructuré y transformé datos operativos para generar informes de apoyo a decisiones.'],
        stack: ['Datos', 'Informes'],
      },
    ],
    eduTitle: 'Formación',
    edu: [
      { title: 'Ingeniería de Sistemas', place: 'UNIMINUTO', when: 'En curso · 7.º de 9 semestres' },
      { title: 'Tecnología en Análisis y Desarrollo de Sistemas', place: 'SENA', when: '2020 – 2022' },
      { title: 'MisiónTIC 2022 · Desarrollo de Software (800 h)', place: 'U. Sergio Arboleda', when: '2021' },
    ],
  },
  projects: {
    kicker: '02 · Proyectos',
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
    kicker: '03 · Contacto',
    title: '¿Hablamos?',
    titleHl: 'Estoy a un mensaje',
    sub: 'Full-Stack AI Engineer en Colombia, trabajo en remoto. Español nativo, inglés B2.',
    available: 'Disponible para nuevas oportunidades · remoto o híbrido',
    cv: 'Descargar CV (PDF)',
    footer: 'Hecho con Angular y FastAPI en mi propio servidor.',
  },
};

export type Dict = typeof ES;

const EN: Dict = {
  cvUrl: '/cv/Julian_Lizcano_Resume.pdf',
  nav: {
    projects: 'Projects',
    ai: 'Ask my AI',
    experience: 'Experience',
    contact: 'Contact',
    available: 'Open to work',
    cv: 'Download CV',
    switchTo: 'Ver en español',
  },
  hero: {
    body: [
      'Full-Stack AI Engineer: I ship LLMs,',
      'agents and automation to production.',
      'Python · FastAPI · Angular · Generative AI',
    ],
    cta: 'See projects',
    marqueeA: ['Python', 'FastAPI', 'Angular', 'React', 'LLMs', 'RAG', 'LangGraph', 'PostgreSQL', 'Docker', 'AI in production'],
    marqueeB: ['APIs', 'AI agents', 'Speech-to-text', 'OCR', 'Automations', 'Self-hosted deploys', 'Colombia · remote'],
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
    foot: 'nearly 4 years shipping code to production',
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
        a: 'Backend with Python and FastAPI (also Node.js/NestJS), REST APIs with JWT/OAuth2, PostgreSQL, MySQL and Redis. On the frontend, Angular and React. In AI: LLMs (OpenAI, Claude, Gemini), RAG, agents with LangChain/LangGraph and MCP. He deploys with Docker on GCP and on his own VPS running Dokploy.',
      },
      {
        label: 'Top achievement',
        q: 'What is his most notable achievement?',
        a: 'At GroupCOS he designed a call-analysis solution with WhisperX on in-house servers, integrated with ChatGPT to evaluate agents and generate automatic feedback. It saves USD 4,000 a month in external APIs and was packaged as a commercial product for new clients.',
      },
      {
        label: 'AI experience?',
        q: 'Does he have AI experience?',
        a: 'Yes: WhatsApp bots and AI agents on the OpenAI API, OCR to validate PDF invoices, speech-to-text with WhisperX, RAG and Hugging Face models adapted to the business. He also runs local models (vLLM, llama.cpp, Ollama) and fine-tunes with LoRA. This very assistant is one of his FastAPI APIs.',
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
  experience: {
    kicker: '01 · Experience',
    title: 'Nearly 4 years',
    titleHl: 'shipping AI to production',
    sub: 'Automation, generative AI and full-stack development at real companies.',
    jobs: [
      {
        role: 'Automation Developer',
        company: 'GroupCOS',
        dates: 'Jul 2023 – Jul 2026',
        place: 'Bogotá · remote',
        stat: { value: 'USD 4,000', label: 'saved every month with AI call analysis' },
        points: [
          'Designed and deployed end-to-end call analysis: WhisperX on in-house servers + ChatGPT to evaluate agents and generate automatic feedback. It was packaged as a commercial product.',
          'OCR tool that validates PDF invoices: extracts personal data and amounts and checks them automatically.',
          'WhatsApp bots and AI agents on the OpenAI API; Hugging Face models adapted to the business.',
          'APIs with FastAPI and NestJS, Angular and React frontends, Docker deploys on GCP with GitLab CI/CD.',
          'Mentored junior developers and interns, working in Scrum.',
        ],
        stack: ['Python', 'FastAPI', 'WhisperX', 'OpenAI', 'Angular', 'React', 'Docker', 'GCP'],
      },
      {
        role: 'RPA Developer',
        company: 'Net Applications',
        dates: 'Oct 2022 – Jul 2023',
        place: 'Bogotá',
        stat: null,
        points: [
          'RPA bots with UiPath and Automation Anywhere to automate client processes.',
          'Python scripts for operational workflows and MySQL database optimization.',
        ],
        stack: ['UiPath', 'Automation Anywhere', 'Python', 'MySQL'],
      },
      {
        role: 'Systems Analysis & Development Apprentice',
        company: 'Siemens Energy',
        dates: 'Apr 2022 – Oct 2022',
        place: 'Bogotá',
        stat: null,
        points: ['Structured and transformed operational data into reports that supported decisions.'],
        stack: ['Data', 'Reporting'],
      },
    ],
    eduTitle: 'Education',
    edu: [
      { title: 'B.S. Systems Engineering', place: 'UNIMINUTO', when: 'In progress · semester 7 of 9' },
      { title: 'Technologist in Systems Analysis & Development', place: 'SENA', when: '2020 – 2022' },
      { title: 'MisiónTIC 2022 · Software Development (800 h)', place: 'U. Sergio Arboleda', when: '2021' },
    ],
  },
  projects: {
    kicker: '02 · Projects',
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
    kicker: '03 · Contact',
    title: "Let's talk?",
    titleHl: "I'm one message away",
    sub: 'Full-Stack AI Engineer based in Colombia, working remotely. Native Spanish, B2 English.',
    available: 'Open to new opportunities · remote or hybrid',
    cv: 'Download resume (PDF)',
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
