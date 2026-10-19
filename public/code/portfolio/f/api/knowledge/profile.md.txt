# Julian Camilo Lizcano Rojas

- Título profesional: Full-Stack AI Engineer (Python · FastAPI · Angular · IA generativa). Es su perfil, no un cargo en una empresa.
- Situación actual: su último empleo fue en GroupCOS y terminó en julio de 2026. Hoy no trabaja en ninguna empresa y está disponible para nuevas oportunidades (remoto o híbrido).
- Ubicación: Girardot, Colombia; trabaja en remoto.
- Idiomas: español (nativo), inglés B2 (conversacional).
- Contacto público: email kradnah@gmail.com · LinkedIn linkedin.com/in/julian-lizcano · web julian-lizcano.com
- El CV en PDF (español e inglés) se puede descargar desde la sección de contacto de la web.

## Perfil

Desarrollador full-stack con casi 4 años de experiencia llevando a producción soluciones de automatización e IA generativa. Construye backends en Python y FastAPI, interfaces en Angular y React, e integra LLMs, speech-to-text y agentes de IA en procesos reales de negocio. Trabaja a diario con desarrollo asistido por IA (Claude Code, OpenCode).

Diseñó una solución de análisis de llamadas con IA que ahorra USD 4.000 al mes y se convirtió en producto comercial. Despliega con Docker en GCP y en infraestructura propia, trabaja con Scrum, participa en diseño técnico y revisión de código, y ha mentoreado a desarrolladores junior.

## Experiencia

### Automation Developer — GroupCOS (julio 2023 – julio 2026, Bogotá, remoto)
- Diseñó y desplegó una solución end-to-end de análisis de llamadas: WhisperX (speech-to-text) en servidores propios integrado con ChatGPT para evaluar asesores y generar feedback automático.
- Esa solución ahorra USD 4.000 al mes en APIs externas (Deepgram) y se empaquetó como producto comercial para nuevos clientes.
- Desarrolló una herramienta de OCR para validar facturas en PDF que extrae datos personales y valores y los verifica automáticamente.
- Desarrolló bots de WhatsApp y agentes de IA con la API de OpenAI, integrados a flujos operativos; adaptó modelos preentrenados de Hugging Face a casos de negocio.
- Construyó APIs REST con Python y FastAPI (y Node.js/NestJS) para productos SaaS que integran servicios internos, bases de datos y APIs externas.
- Desarrolló frontends en Angular y React con TypeScript, conectados a los servicios backend.
- Desplegó aplicaciones en contenedores Docker sobre GCP con CI/CD en GitLab, y optimizó bases de datos MySQL para rendimiento y consistencia.
- Automatizó procesos de datos con Python, Selenium y Pandas, eliminando trabajo manual repetitivo.
- Procesó grabaciones y datos personales de clientes aplicando controles de acceso y privacidad.
- Mentoreó a desarrolladores junior y practicantes, y tradujo necesidades de clientes y áreas de negocio en requerimientos técnicos, trabajando bajo Scrum.

### RPA Developer — Net Applications (octubre 2022 – julio 2023, Bogotá)
- Bots de RPA con UiPath y Automation Anywhere para automatizar procesos de clientes.
- Scripts en Python para automatizar flujos operativos y optimización de bases de datos MySQL.

### Aprendiz de Análisis y Desarrollo de Sistemas — Siemens Energy (abril 2022 – octubre 2022, Bogotá)
- Estructuró y transformó datos operativos para generar informes de apoyo a decisiones.

## Habilidades técnicas

- IA generativa y NLP: LLMs (OpenAI, Claude, Gemini, OpenRouter), RAG (embeddings, chunking, LlamaIndex), agentes de IA (LangChain, LangGraph, Hermes Agent), function calling / tool use, MCP, chatbots, OCR y clasificación de documentos, speech-to-text (WhisperX), text-to-speech, modelos de visión, prompt engineering, prompt caching.
- Modelos e inferencia: Hugging Face Transformers, PyTorch, fine-tuning (LoRA), vLLM, llama.cpp, cuantización (GGUF), Ollama, generación de imagen y video (ComfyUI), modelos de decisión (Laya).
- Desarrollo asistido por IA: Claude Code, OpenCode, flujos con agentes, MCP y Agent Skills.
- Backend: Python, FastAPI, Flask, APIs REST, Node.js, NestJS, WebSockets y SSE (streaming), Celery, RabbitMQ, Kafka, procesamiento asíncrono.
- Frontend: Angular (17+, signals), React, TypeScript, JavaScript.
- Datos y bases de datos: PostgreSQL (incluido PostGIS en sus proyectos), MySQL, Redis, optimización de consultas; Pandas para limpieza, transformación y ETL.
- Cloud y DevOps: Docker, Docker Compose, GCP, AWS, CI/CD (GitLab CI, GitHub Actions), Linux, Nginx, Dokploy, Git (GitHub, GitLab, Azure DevOps).
- Automatización: Selenium, Playwright, UiPath, Automation Anywhere.
- Seguridad y privacidad: JWT, OAuth2, defensa contra prompt injection, manejo de datos personales y control de acceso.
- Metodología: Scrum, diseño técnico, revisión de código, mentoría.

## Educación

- Ingeniería de Sistemas — UNIMINUTO (en curso, 7.º de 9 semestres).
- Tecnología en Análisis y Desarrollo de Sistemas de Información — SENA (2020 – 2022).
- MisiónTIC 2022, Desarrollo de Software (800 horas) — Universidad Sergio Arboleda (2021).

## Proyectos personales (los construyó solo, apoyándose en herramientas de IA)

### Casa Zhef — casazhef.com (en producción)
- Web de su propio negocio: Julian tiene una cocina oculta ("restaurante") que abre los fines de semana en Girardot, Cundinamarca, y esta es su web real.
- Muestra el menú por categorías, horarios, ubicación y pedidos por WhatsApp.
- Stack: Angular 20 + Tailwind CSS 4 en el frontend; API NestJS para el menú; Docker; desplegado en su propio VPS con Dokploy y Traefik (HTTPS con Let's Encrypt).

### rideapp — app de movilidad tipo Uber (demo funcional)
- Demo de transporte para Girardot, Ricaurte y Flandes (Colombia), con app de pasajero, app de conductor y panel web de administración.
- Apps móviles con React Native (Expo) y Google Maps; las APK de Android se pueden descargar desde la web.
- Backend NestJS (Fastify) con PostgreSQL + PostGIS, Redis (ubicación en vivo, bloqueos de emparejamiento, rate limiting), BullMQ para colas y Socket.IO para tiempo real.
- Emparejamiento de viajes con máquina de estados, tarifas, notificaciones push y recibos por correo.
- Seguridad: Argon2id, JWT ES256 con refresh tokens rotativos, panel con segundo factor (TOTP), cifrado de documentos, escaneo de imágenes con Trivy, tratamiento de datos según la Ley 1581 de Colombia.
- Monorepo pnpm + Turborepo con contratos Zod compartidos entre backend y clientes; tests de integración con Testcontainers.

### Este portfolio y su asistente de IA
- Frontend Angular con diseño brutalista; el asistente es una API en Python (FastAPI) que usa modelos vía OpenRouter, con límites de uso por IP y diarios, respuestas en streaming y presupuesto acotado.

### Infraestructura propia
- Administra su propio VPS con Dokploy y Traefik, donde despliega todos sus proyectos con repos git propios y despliegue automático en cada push.
