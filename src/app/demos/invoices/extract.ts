// Lectura de la factura en el navegador: texto y posición de cada palabra sobre la imagen de la página.
// PDF digital → pdf.js (texto exacto). PDF escaneado o imagen → tesseract.js (OCR en español).

/** Coordenadas en píxeles de la imagen renderizada de la página. */
export interface Word {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PageScan {
  image: string; // data URL (JPEG) de la página
  width: number;
  height: number;
  words: Word[];
  text: string;
  ocr: boolean;
}

export type Progress = (stage: 'read' | 'ocr', ratio?: number) => void;

const SCALE = 2;
const MIN_TEXT = 40; // con menos caracteres se considera escaneado
const MAX_SIDE = 2400;

type PdfJs = typeof import('pdfjs-dist');
let pdfjs: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  pdfjs ??= import('pdfjs-dist').then((lib) => {
    lib.GlobalWorkerOptions.workerPort = new Worker(new URL('./pdf.worker', import.meta.url), { type: 'module' });
    return lib;
  });
  return pdfjs;
}

export async function readPdf(file: Blob, maxPages: number, progress: Progress): Promise<PageScan[]> {
  progress('read');
  const lib = await loadPdfJs();
  const task = lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const pages: PageScan[] = [];
  try {
    for (let n = 1; n <= Math.min(doc.numPages, maxPages); n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: SCALE });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvas, viewport }).promise;

      const content = await page.getTextContent();
      const items = content.items.filter((i): i is (typeof i & { str: string; transform: number[]; width: number }) => 'str' in i && !!i.str.trim());
      const chars = items.reduce((n, i) => n + i.str.trim().length, 0);
      if (chars < MIN_TEXT) {
        pages.push(await ocrCanvas(canvas, progress));
        continue;
      }
      const placed = items.map((item) => {
        const tx = lib.Util.transform(viewport.transform, item.transform);
        const h = Math.hypot(tx[2], tx[3]);
        return { str: item.str, x: tx[4], base: tx[5], h, w: item.width * viewport.scale };
      });
      pages.push({
        image: canvas.toDataURL('image/jpeg', 0.85),
        width: canvas.width,
        height: canvas.height,
        words: placed.flatMap((p) => splitWords(p.str, p.x, p.base - p.h, p.w, p.h)),
        text: toLines(placed),
        ocr: false,
      });
    }
  } finally {
    void task.destroy();
  }
  return pages;
}

export async function readImage(file: Blob, progress: Progress): Promise<PageScan[]> {
  progress('read');
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return [await ocrCanvas(canvas, progress)];
}

async function ocrCanvas(canvas: HTMLCanvasElement, progress: Progress): Promise<PageScan> {
  progress('ocr', 0);
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('spa', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') progress('ocr', m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
    const words: Word[] = (data.blocks ?? []).flatMap((b) =>
      b.paragraphs.flatMap((p) =>
        p.lines.flatMap((l) =>
          l.words.map((w) => ({ text: w.text, x: w.bbox.x0, y: w.bbox.y0, w: w.bbox.x1 - w.bbox.x0, h: w.bbox.y1 - w.bbox.y0 })),
        ),
      ),
    );
    return { image: canvas.toDataURL('image/jpeg', 0.85), width: canvas.width, height: canvas.height, words, text: data.text, ocr: true };
  } finally {
    await worker.terminate();
  }
}

/** Divide un fragmento de pdf.js en palabras, repartiendo el ancho por caracteres. */
function splitWords(str: string, x: number, y: number, w: number, h: number): Word[] {
  const charW = w / Math.max(1, str.length);
  const out: Word[] = [];
  for (const m of str.matchAll(/\S+/g)) {
    out.push({ text: m[0], x: x + (m.index ?? 0) * charW, y, w: m[0].length * charW, h });
  }
  return out;
}

/** Reconstruye las líneas en orden de lectura (por altura y luego de izquierda a derecha). */
function toLines(items: { str: string; x: number; base: number; h: number; w: number }[]): string {
  const sorted = [...items].sort((a, b) => a.base - b.base || a.x - b.x);
  const lines: (typeof items)[] = [];
  for (const it of sorted) {
    const line = lines.at(-1);
    if (line && Math.abs(line[0].base - it.base) < it.h * 0.5) line.push(it);
    else lines.push([it]);
  }
  return lines
    .map((line) =>
      line
        .sort((a, b) => a.x - b.x)
        .reduce((acc, it, i, arr) => {
          if (i === 0) return it.str;
          const prev = arr[i - 1];
          const gap = it.x - (prev.x + prev.w);
          return acc + (gap > it.h * 1.5 ? '   ' : ' ') + it.str;
        }, '')
        .trim(),
    )
    .filter(Boolean)
    .join('\n');
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/**
 * Ubica un fragmento (el `raw` que devolvió la IA) entre las palabras de la página y devuelve su
 * recuadro. Compara sin espacios, tildes ni puntuación para tolerar diferencias de formato.
 */
export function locate(words: Word[], raw: string): Word | null {
  const needle = fold(raw);
  if (needle.length < 2) return null;
  let hay = '';
  const owner: number[] = [];
  words.forEach((w, i) => {
    const f = fold(w.text);
    hay += f;
    for (let k = 0; k < f.length; k++) owner.push(i);
  });
  // Solo coincidencias que empiezan y terminan en borde de palabra ("19" no debe caer dentro de "0199").
  const starts = (i: number) => i === 0 || owner[i - 1] !== owner[i];
  const ends = (i: number) => i === hay.length - 1 || owner[i + 1] !== owner[i];
  let at = hay.indexOf(needle);
  while (at >= 0 && !(starts(at) && ends(at + needle.length - 1))) at = hay.indexOf(needle, at + 1);
  if (at < 0) return null;
  const hit = words.slice(owner[at], owner[at + needle.length - 1] + 1);
  const x = Math.min(...hit.map((w) => w.x));
  const y = Math.min(...hit.map((w) => w.y));
  return {
    text: raw,
    x,
    y,
    w: Math.max(...hit.map((w) => w.x + w.w)) - x,
    h: Math.max(...hit.map((w) => w.y + w.h)) - y,
  };
}

/** Palabras con datos personales para el modo privacidad: correos, teléfonos y documentos. */
export function personalData(words: Word[], extra: string[]): Word[] {
  const found = words.filter((w) => /@/.test(w.text));
  const text = words.map((w) => w.text);
  // Teléfonos tipo 310 555 0101 / 601 555 0199 (tres palabras seguidas).
  for (let i = 0; i + 2 < text.length; i++) {
    if (/^\d{3}$/.test(text[i]) && /^\d{3}$/.test(text[i + 1]) && /^\d{4}$/.test(text[i + 2])) {
      found.push(words[i], words[i + 1], words[i + 2]);
    }
  }
  for (const raw of extra) {
    const box = raw && locate(words, raw);
    if (box) found.push(box);
  }
  return found;
}
