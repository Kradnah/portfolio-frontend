#!/usr/bin/env node
// Exporta una selección curada del código de cada proyecto a public/code/<slug>/ para el visor /codigo/:slug.
//
// Solo lee archivos versionados en un commit concreto (git ls-files + git show <ref>:<ruta>), nunca la
// copia de trabajo. Antes de escribir nada pasa un escaneo de secretos: si encuentra algo, aborta sin
// tocar el export anterior.
//
//   node scripts/export-code.mjs            → todos los proyectos de scripts/code-projects.json
//   node scripts/export-code.mjs rideapp    → solo uno
//
// Para el propio portfolio (ref HEAD): primero commit del código, luego export, luego commit del export.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'code');
const MAX_BYTES = 200_000;

/** Nunca se exportan, aunque un include los cubra. */
const ALWAYS_EXCLUDE = [
  '**/.env*', '**/*.pem', '**/*.key', '**/*.p12', '**/*.pfx', '**/*.jks', '**/*.keystore',
  '**/pnpm-lock.yaml', '**/package-lock.json', '**/yarn.lock', '**/uv.lock', '**/poetry.lock',
  '**/google-services.json', '**/GoogleService-Info.plist', '**/*.min.js', '**/*.map',
];

const BINARY_EXT = /\.(png|jpe?g|gif|webp|avif|ico|bmp|ttf|otf|woff2?|eot|mp[34]|webm|wav|ogg|m4a|pdf|zip|gz|tgz|apk|aab|jar|exe|dll|so|dylib|bin|lottie)$/i;

/** Patrones de secretos. El valor encontrado nunca se imprime completo. */
const SECRETS = [
  ['clave privada', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/],
  ['OpenRouter', /sk-or-v1-[a-f0-9]{32,}/],
  ['Anthropic', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI', /sk-(?:proj-)?[A-Za-z0-9_-]{32,}/],
  ['AWS access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
  ['GitHub token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|github_pat_[A-Za-z0-9_]{40,}/],
  ['GitLab token', /glpat-[A-Za-z0-9_-]{20}/],
  ['Slack token', /xox[abprs]-[A-Za-z0-9-]{10,}/],
  ['Stripe key', /\b[sr]k_live_[A-Za-z0-9]{20,}/],
  ['JWT', /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  // Datos de infraestructura que no son secretos pero no conviene publicar (acceso SSH).
  ['usuario SSH del servidor', /\b[a-z_][a-z0-9_-]*@\d{1,3}(?:\.\d{1,3}){3}\b/],
  ['URL con contraseña', /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@'"`]+:([^\s@'"`$]{6,})@(?!localhost|127\.0\.0\.1|db\b|postgres\b|redis\b)/i],
  ['asignación de secreto', /(?:secret|password|passwd|api[_-]?key|access[_-]?token|private[_-]?key)["']?\s*[:=]\s*["'`]([^"'`\s${}<>]{20,})["'`]/i],
];

const LANGS = {
  ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'tsx', js: 'javascript', mjs: 'javascript',
  cjs: 'javascript', jsx: 'jsx', py: 'python', html: 'html', css: 'css', scss: 'scss', json: 'json',
  jsonc: 'jsonc', yml: 'yaml', yaml: 'yaml', md: 'markdown', prisma: 'prisma', sql: 'sql', sh: 'shellscript',
  toml: 'toml', conf: 'nginx',
};

function langOf(path) {
  const name = path.split('/').pop();
  if (name === 'Dockerfile' || name.endsWith('.Dockerfile')) return 'dockerfile';
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  return LANGS[ext] ?? 'text';
}

/** Glob mínimo: `**` cruza carpetas, `*` no; sin `/` el patrón se compara con el nombre del archivo. */
function globToRegex(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      const slash = glob[i + 2] === '/';
      re += slash ? '(?:.*/)?' : '.*';
      i += slash ? 2 : 1;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

const matcher = (globs) => {
  const res = globs.map(globToRegex);
  return (path) => res.some((r) => r.test(path));
};

const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { maxBuffer: 64 * 1024 * 1024 });

function collect(source) {
  const { repo, ref = 'HEAD', prefix = '', include, exclude = [] } = source;
  const commit = git(repo, 'rev-parse', ref).toString().trim();
  const date = git(repo, 'show', '-s', '--format=%cI', commit).toString().trim();
  const isIncluded = matcher(include);
  const isExcluded = matcher([...ALWAYS_EXCLUDE, ...exclude]);
  const files = [];
  const skipped = [];

  const paths = git(repo, 'ls-tree', '-r', '--name-only', '-z', commit).toString().split('\0').filter(Boolean);
  for (const path of paths) {
    if (!isIncluded(path) || isExcluded(path)) continue;
    if (BINARY_EXT.test(path)) continue;
    const buf = git(repo, 'show', `${commit}:${path}`);
    if (buf.length > MAX_BYTES) { skipped.push(`${prefix}${path} (${Math.round(buf.length / 1000)} kB)`); continue; }
    if (buf.includes(0)) continue; // binario sin extensión conocida
    files.push({ path: prefix + path, text: buf.toString('utf8') });
  }
  return { repo, commit, date, prefix, files, skipped };
}

/** `allowSecrets` en code-projects.json: falsos positivos revisados a mano (p. ej. contraseñas de tests). */
function scan(files, allow = []) {
  const allowed = allow.map((a) => ({ match: matcher([a.path]), kind: a.kind }));
  const hits = [];
  for (const { path, text } of files) {
    text.split('\n').forEach((line, i) => {
      for (const [kind, re] of SECRETS) {
        if (allowed.some((a) => a.kind === kind && a.match(path))) continue;
        const m = line.match(re);
        if (m) hits.push(`  ${path}:${i + 1}  ${kind}  (${(m[1] ?? m[0]).slice(0, 4)}…)`);
      }
    });
  }
  return hits;
}

function exportProject(project) {
  const sources = project.sources.map(collect);
  const files = sources.flatMap((s) => s.files).sort((a, b) => a.path.localeCompare(b.path));

  const hits = scan(files, project.allowSecrets);
  if (hits.length) {
    console.error(`✗ ${project.slug}: posibles secretos, no se exporta nada:\n${hits.join('\n')}`);
    console.error('  Si es un falso positivo, excluye el archivo en code-projects.json o cambia el código.');
    process.exitCode = 1;
    return;
  }

  const paths = new Set(files.map((f) => f.path));
  for (const h of project.highlights ?? []) {
    if (!paths.has(h.path)) throw new Error(`${project.slug}: el destacado ${h.path} no está en el export`);
  }

  const dir = join(OUT, project.slug);
  rmSync(dir, { recursive: true, force: true });
  const langs = {};
  const entries = files.map(({ path, text }) => {
    const target = join(dir, 'f', `${path}.txt`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
    const lines = text.length ? text.split('\n').length - (text.endsWith('\n') ? 1 : 0) : 0;
    const lang = langOf(path);
    langs[lang] = (langs[lang] ?? 0) + lines;
    return { p: path, l: lines, lang };
  });

  const manifest = {
    slug: project.slug,
    name: project.name,
    exportedAt: new Date().toISOString(),
    sources: sources.map((s) => ({ prefix: s.prefix, commit: s.commit.slice(0, 7), date: s.date })),
    totalLines: entries.reduce((n, e) => n + e.l, 0),
    langs: Object.entries(langs).sort((a, b) => b[1] - a[1]).map(([lang, lines]) => ({ lang, lines })),
    highlights: project.highlights ?? [],
    files: entries,
  };
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest));

  const skipped = sources.flatMap((s) => s.skipped);
  console.log(`✓ ${project.slug}: ${entries.length} archivos, ${manifest.totalLines} líneas`
    + ` (${manifest.sources.map((s) => `${s.prefix || '/'}@${s.commit}`).join(', ')})`);
  if (skipped.length) console.log(`  omitidos por tamaño: ${skipped.join(', ')}`);
}

const projects = JSON.parse(readFileSync(join(ROOT, 'scripts', 'code-projects.json'), 'utf8'));
const only = process.argv[2];
const selected = only ? projects.filter((p) => p.slug === only) : projects;
if (!selected.length) throw new Error(`No hay proyecto "${only}" en code-projects.json`);
selected.forEach(exportProject);
