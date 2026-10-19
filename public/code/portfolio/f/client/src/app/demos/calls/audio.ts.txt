/** Whisper espera audio mono a 16 kHz. */
export const SAMPLE_RATE = 16_000;

/** Decodifica cualquier formato que entienda el navegador y lo remuestrea a 16 kHz mono. */
export async function decodeToMono16k(blob: Blob): Promise<{ audio: Float32Array; duration: number }> {
  const data = await blob.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(data);
    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * SAMPLE_RATE), SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination); // un canal de salida: el navegador mezcla a mono
    source.start();
    const rendered = await offline.startRendering();
    return { audio: rendered.getChannelData(0), duration: decoded.duration };
  } finally {
    void ctx.close();
  }
}

/** Duración leyendo solo los metadatos, para rechazar audios largos antes de decodificarlos. */
export function probeDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const el = new Audio();
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(el.duration);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('unreadable'));
    };
    el.src = url;
  });
}

/** Grabación con el micrófono que se detiene sola al llegar a `maxSeconds`. */
export class MicRecorder {
  private recorder?: MediaRecorder;
  private stream?: MediaStream;
  private parts: Blob[] = [];
  private timer?: ReturnType<typeof setTimeout>;

  async start(maxSeconds: number, onStop: (blob: Blob) => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    this.parts = [];
    this.recorder = new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (e) => e.data.size && this.parts.push(e.data);
    this.recorder.onstop = () => {
      clearTimeout(this.timer);
      this.stream?.getTracks().forEach((t) => t.stop());
      onStop(new Blob(this.parts, { type: this.recorder?.mimeType || 'audio/webm' }));
    };
    this.recorder.start();
    this.timer = setTimeout(() => this.stop(), maxSeconds * 1000);
  }

  stop(): void {
    if (this.recorder?.state === 'recording') this.recorder.stop();
  }

  cancel(): void {
    clearTimeout(this.timer);
    if (this.recorder) this.recorder.onstop = () => this.stream?.getTracks().forEach((t) => t.stop());
    this.stop();
  }
}
