# Coral

Plataforma multiempresa de atención al cliente con IA: los clientes escriben por WhatsApp o por un
widget web, un agente de IA responde con el catálogo y los documentos de cada empresa, y un asesor
humano puede tomar la conversación en tiempo real desde el panel.

Plan completo y fases: [docs/PLAN.md](docs/PLAN.md).

## Estructura

| Paquete              | Qué es                                                                 |
| -------------------- | ---------------------------------------------------------------------- |
| `apps/api`           | API NestJS 12 (Fastify) + Prisma 7 + PostgreSQL + Redis                |
| `apps/web`           | Panel Angular 22 (zoneless, signals) + Tailwind 4                      |
| `packages/contracts` | Esquemas Zod compartidos (peticiones, respuestas, errores, JWT claims) |
| `packages/config`    | tsconfig y ESLint compartidos                                          |

## Desarrollo local

Requisitos: pnpm 12 y Docker (para Postgres y Redis). pnpm descarga Node 24 por su cuenta
(`devEngines.runtime` en `package.json`).

```sh
pnpm install
pnpm infra:up                                   # Postgres (pgvector) + Redis
cp apps/api/.env.example apps/api/.env          # y rellena JWT_PRIVATE_KEY
pnpm --filter @coral/api db:deploy              # migraciones
pnpm --filter @coral/api cli:create-owner -- --org "Mi restaurante" --email tu@correo.com --name "Tu Nombre"
pnpm dev                                        # API en :3000, panel en :4200 (proxy /api)
```

Comprobaciones: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

## Despliegue

Dokploy en la VPS, mismo formato que el resto de proyectos: repo bare `~/repos/coral.git` con un
hook `post-receive` que despliega solo las apps cuyos archivos cambiaron (`coral.git/dokploy-apps`).

| App | Dominio                                                                  | Dockerfile           |
| --- | ------------------------------------------------------------------------ | -------------------- |
| api | `api.julian-lizcano.com` y `crm.julian-lizcano.com/api` (mismo origen que el panel) | `apps/api/Dockerfile` |
| web | `crm.julian-lizcano.com`                                                 | `apps/web/Dockerfile` |

```sh
git push origin main
```

## Decisiones de seguridad

- Access token JWT ES256 de 15 min, solo en memoria del panel; refresh token rotativo en cookie
  `__Host-` httpOnly + SameSite=Strict, con CSRF double-submit. Reutilizar un refresh token ya
  rotado revoca toda la sesión.
- Contraseñas con Argon2id (parámetros OWASP) y verificación en tiempo constante.
- Multitenancy: la organización activa va en el token y toda consulta de negocio filtra por ella.
- Variables de entorno validadas con Zod al arrancar; los logs ocultan cabeceras y campos sensibles.
