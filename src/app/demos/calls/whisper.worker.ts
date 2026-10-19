/// <reference lib="webworker" />
// Transcribe audio con Whisper dentro del navegador (transformers.js + ONNX Runtime Web).
// El audio nunca sale del equipo del visitante; el modelo (~77 MB) se descarga de Hugging Face una
// vez y queda en la caché del navegador.

import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import type { WorkerIn, WorkerOut } from './whisper.types';

const MODEL = 'onnx-community/whisper-base';

env.allowLocalModels = false;

let asr: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
const files = new Map<string, { loaded: number; total: number }>();

const post = (msg: WorkerOut) => postMessage(msg);

function load(): Promise<AutomaticSpeechRecognitionPipeline> {
  asr ??= pipeline('automatic-speech-recognition', MODEL, {
    device: 'wasm',
    dtype: 'q8',
    progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (p.status !== 'progress' || !p.file || !p.total) return;
      files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
      let loaded = 0;
      let total = 0;
      for (const f of files.values()) {
        loaded += f.loaded;
        total += f.total;
      }
      post({ type: 'download', loaded, total });
    },
  }) as Promise<AutomaticSpeechRecognitionPipeline>;
  return asr;
}

addEventListener('message', async ({ data }: MessageEvent<WorkerIn>) => {
  if (data.type !== 'transcribe') return;
  try {
    const transcriber = await load();
    post({ type: 'transcribing' });
    const out = await transcriber(data.audio, {
      language: data.language,
      task: 'transcribe',
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    const result = Array.isArray(out) ? out[0] : out;
    const chunks = (result.chunks ?? [{ timestamp: [0, data.audio.length / 16000], text: result.text }])
      .map((c) => ({
        start: c.timestamp[0] ?? 0,
        end: c.timestamp[1] ?? c.timestamp[0] ?? 0,
        text: c.text.trim(),
      }))
      .filter((c) => c.text);
    post({ type: 'done', chunks });
  } catch (err) {
    asr = null; // permite reintentar si falló la descarga
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
});
