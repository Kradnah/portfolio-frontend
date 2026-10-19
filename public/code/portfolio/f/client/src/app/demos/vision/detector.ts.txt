// Detección en el navegador con MediaPipe: objetos (EfficientDet Lite0, 80 clases COCO) y manos.
// Los modelos (~12 MB) se descargan de Google una vez y quedan en caché; el video no sale del equipo.

import type { HandLandmarker, ObjectDetector } from '@mediapipe/tasks-vision';

const VERSION = '1.1.1';
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const OBJECT_MODEL =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/latest/efficientdet_lite0.tflite';
const HAND_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Detection extends Box {
  /** Clase COCO en inglés (la UI la traduce). */
  label: string;
  score: number;
  inHand: boolean;
}

export interface Hand {
  /** Puntos en píxeles del video (21 por mano). */
  points: { x: number; y: number }[];
  box: Box;
}

export interface FrameResult {
  objects: Detection[];
  hands: Hand[];
  /** Milisegundos de inferencia de este cuadro (los dos modelos). */
  ms: number;
}

/** Conexiones del esqueleto de la mano (índices de MediaPipe). */
export const HAND_LINKS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11],
  [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

export class Detector {
  private constructor(
    private readonly objects: ObjectDetector,
    private readonly hands: HandLandmarker,
    readonly delegate: 'GPU' | 'CPU',
  ) {}

  static async load(): Promise<Detector> {
    const { FilesetResolver, ObjectDetector, HandLandmarker } = await import('@mediapipe/tasks-vision');
    const files = await FilesetResolver.forVisionTasks(WASM);
    const make = async (delegate: 'GPU' | 'CPU') =>
      Promise.all([
        ObjectDetector.createFromOptions(files, {
          baseOptions: { modelAssetPath: OBJECT_MODEL, delegate },
          runningMode: 'VIDEO',
          scoreThreshold: 0.4,
          maxResults: 8,
        }),
        HandLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: HAND_MODEL, delegate },
          runningMode: 'VIDEO',
          numHands: 2,
        }),
      ]);
    // ?delegate=cpu fuerza la CPU (diagnóstico en equipos con WebGL problemático).
    const forceCpu = new URLSearchParams(location.search).get('delegate') === 'cpu';
    try {
      if (forceCpu) throw new Error('cpu');
      const [o, h] = await make('GPU');
      // Algunas GPU (o GPU emuladas) no fallan pero devuelven cero detecciones: se comprueba con una
      // imagen donde el modelo siempre encuentra algo y, si no, se usa la CPU.
      if (await selfTest(o)) return new Detector(o, h, 'GPU');
      o.close();
      h.close();
      throw new Error('gpu-empty');
    } catch {
      // Sin WebGL utilizable: misma detección en CPU (más lenta).
      const [o, h] = await make('CPU');
      return new Detector(o, h, 'CPU');
    }
  }

  detect(video: HTMLVideoElement, now: number): FrameResult {
    const t0 = performance.now();
    const w = video.videoWidth;
    const h = video.videoHeight;
    const objRes = this.objects.detectForVideo(video, now);
    const handRes = this.hands.detectForVideo(video, now);
    const ms = performance.now() - t0;

    const hands: Hand[] = handRes.landmarks.map((lm) => {
      const points = lm.map((p) => ({ x: p.x * w, y: p.y * h }));
      return { points, box: boundsOf(points) };
    });

    const objects: Detection[] = objRes.detections
      .map((d) => {
        const b = d.boundingBox!;
        const cat = d.categories[0];
        return { x: b.originX, y: b.originY, w: b.width, h: b.height, label: cat.categoryName, score: cat.score, inHand: false };
      })
      .filter((d) => d.label);

    // "En la mano": el objeto (que no sea la persona) que más se superpone con alguna mano.
    let best: Detection | null = null;
    let bestOverlap = 0;
    for (const o of objects) {
      if (o.label === 'person') continue;
      for (const hand of hands) {
        const ov = overlap(o, grow(hand.box, 0.35));
        if (ov > bestOverlap) {
          bestOverlap = ov;
          best = o;
        }
      }
    }
    if (best && bestOverlap > 0.15) best.inHand = true;
    return { objects, hands, ms };
  }

  close(): void {
    this.objects.close();
    this.hands.close();
  }
}

/**
 * Foto CC0 "Free hand holding coffee cup" (rawpixel), reducida a 512 px: el detector encuentra un
 * objeto en ella con cualquier aceleración que funcione bien.
 */
const SELF_TEST_IMAGE = '/demo-data/vision/selftest.jpg';

async function selfTest(detector: ObjectDetector): Promise<boolean> {
  const img = new Image();
  img.src = SELF_TEST_IMAGE;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  return detector.detectForVideo(canvas, performance.now()).detections.length > 0;
}

function boundsOf(points: { x: number; y: number }[]): Box {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function grow(b: Box, f: number): Box {
  return { x: b.x - b.w * f, y: b.y - b.h * f, w: b.w * (1 + 2 * f), h: b.h * (1 + 2 * f) };
}

/** Fracción del objeto que cae dentro de la zona de la mano. */
function overlap(a: Box, b: Box): number {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return (ix * iy) / Math.max(1, a.w * a.h);
}

/** Nombres en español de las 80 clases COCO. */
export const LABELS_ES: Record<string, string> = {
  person: 'persona', bicycle: 'bicicleta', car: 'carro', motorcycle: 'moto', airplane: 'avión', bus: 'bus',
  train: 'tren', truck: 'camión', boat: 'bote', 'traffic light': 'semáforo', 'fire hydrant': 'hidrante',
  'stop sign': 'señal de pare', 'parking meter': 'parquímetro', bench: 'banca', bird: 'pájaro', cat: 'gato',
  dog: 'perro', horse: 'caballo', sheep: 'oveja', cow: 'vaca', elephant: 'elefante', bear: 'oso',
  zebra: 'cebra', giraffe: 'jirafa', backpack: 'morral', umbrella: 'sombrilla', handbag: 'bolso', tie: 'corbata',
  suitcase: 'maleta', frisbee: 'frisbee', skis: 'esquís', snowboard: 'snowboard', 'sports ball': 'balón',
  kite: 'cometa', 'baseball bat': 'bate', 'baseball glove': 'guante de béisbol', skateboard: 'patineta',
  surfboard: 'tabla de surf', 'tennis racket': 'raqueta', bottle: 'botella', 'wine glass': 'copa', cup: 'taza',
  fork: 'tenedor', knife: 'cuchillo', spoon: 'cuchara', bowl: 'tazón', banana: 'banano', apple: 'manzana',
  sandwich: 'sánduche', orange: 'naranja', broccoli: 'brócoli', carrot: 'zanahoria', 'hot dog': 'perro caliente',
  pizza: 'pizza', donut: 'dona', cake: 'torta', chair: 'silla', couch: 'sofá', 'potted plant': 'planta',
  bed: 'cama', 'dining table': 'mesa', toilet: 'inodoro', tv: 'televisor', laptop: 'portátil', mouse: 'mouse',
  remote: 'control remoto', keyboard: 'teclado', 'cell phone': 'celular', microwave: 'microondas', oven: 'horno',
  toaster: 'tostadora', sink: 'lavaplatos', refrigerator: 'nevera', book: 'libro', clock: 'reloj',
  vase: 'florero', scissors: 'tijeras', 'teddy bear': 'peluche', 'hair drier': 'secador', toothbrush: 'cepillo de dientes',
};
