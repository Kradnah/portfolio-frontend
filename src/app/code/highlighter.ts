import type { HighlighterCore, LanguageRegistration, ThemeRegistration } from 'shiki/core';

/** Tema propio con la paleta del EVA-01 (la misma de la sección de experiencia). */
const EVA_THEME: ThemeRegistration = {
  name: 'eva-01',
  type: 'dark',
  colors: { 'editor.background': '#160b26', 'editor.foreground': '#ece6f5' },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#8a78a8', fontStyle: 'italic' } },
    { scope: ['keyword', 'storage', 'storage.type', 'keyword.control', 'keyword.operator.new'], settings: { foreground: '#ff7a00' } },
    { scope: ['string', 'string.template', 'markup.inline.raw'], settings: { foreground: '#8be000' } },
    { scope: ['constant.numeric', 'constant.language', 'support.constant'], settings: { foreground: '#ff5c7a' } },
    { scope: ['entity.name.function', 'support.function', 'meta.function-call'], settings: { foreground: '#c9a2ff' } },
    { scope: ['entity.name.type', 'entity.name.class', 'support.type', 'support.class', 'entity.other.inherited-class'], settings: { foreground: '#ffd23f' } },
    { scope: ['variable.parameter', 'meta.decorator', 'entity.name.decorator'], settings: { foreground: '#f2a65a' } },
    { scope: ['entity.name.tag', 'markup.heading'], settings: { foreground: '#ff7a00', fontStyle: 'bold' } },
    { scope: ['entity.other.attribute-name', 'support.type.property-name', 'meta.object-literal.key'], settings: { foreground: '#b9e86a' } },
    { scope: ['keyword.operator', 'punctuation'], settings: { foreground: '#b8a8d4' } },
    { scope: ['markup.bold'], settings: { fontStyle: 'bold' } },
    { scope: ['markup.italic'], settings: { fontStyle: 'italic' } },
  ],
};

type LangModule = { default: LanguageRegistration[] };

/** Solo se descarga la gramática de los lenguajes que realmente se abren. */
const LANGS: Record<string, () => Promise<LangModule>> = {
  typescript: () => import('@shikijs/langs/typescript'),
  tsx: () => import('@shikijs/langs/tsx'),
  javascript: () => import('@shikijs/langs/javascript'),
  jsx: () => import('@shikijs/langs/jsx'),
  python: () => import('@shikijs/langs/python'),
  html: () => import('@shikijs/langs/html'),
  css: () => import('@shikijs/langs/css'),
  scss: () => import('@shikijs/langs/scss'),
  json: () => import('@shikijs/langs/json'),
  jsonc: () => import('@shikijs/langs/jsonc'),
  yaml: () => import('@shikijs/langs/yaml'),
  markdown: () => import('@shikijs/langs/markdown'),
  prisma: () => import('@shikijs/langs/prisma'),
  sql: () => import('@shikijs/langs/sql'),
  shellscript: () => import('@shikijs/langs/shellscript'),
  toml: () => import('@shikijs/langs/toml'),
  dockerfile: () => import('@shikijs/langs/dockerfile'),
  nginx: () => import('@shikijs/langs/nginx'),
};

let highlighter: Promise<HighlighterCore> | null = null;
const loaded = new Set<string>();

function getHighlighter(): Promise<HighlighterCore> {
  highlighter ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript'),
    ]);
    return createHighlighterCore({ themes: [EVA_THEME], langs: [], engine: createJavaScriptRegexEngine() });
  })();
  return highlighter;
}

/** Devuelve el HTML de Shiki con una línea por `<span class="line" data-line="n">`. */
export async function highlight(code: string, lang: string): Promise<string> {
  const hl = await getHighlighter();
  let useLang = 'text';
  if (LANGS[lang]) {
    if (!loaded.has(lang)) {
      await hl.loadLanguage(...(await LANGS[lang]()).default);
      loaded.add(lang);
    }
    useLang = lang;
  }
  return hl.codeToHtml(code, {
    lang: useLang,
    theme: 'eva-01',
    transformers: [
      {
        line(node, line) {
          node.properties['data-line'] = line;
        },
      },
    ],
  });
}
